// Builds the live ScenarioState from the static real-data snapshots in lib/data/*.json,
// and applies incident updates client-side. No backend, no routing algorithm — zone/shelter
// assignment is a simple nearest-available-capacity match, and ambulance/blocked-road
// "routes" are straight connectors for visualization, not road-network paths.
import zonesData from "./data/zones.json";
import sheltersData from "./data/shelters.json";
import roadsData from "./data/roads.json";
import stationsData from "./data/stations.json";
import hazardData from "./data/hazard.json";
import trafficData from "./data/traffic.json";
import { centroid, haversineKm } from "./geo";
import { parseIncident } from "./incidentParser";
import type {
  Ambulance,
  Assignment,
  BlockedRoad,
  Hazard,
  Incident,
  Metrics,
  RoadsByRef,
  ScenarioState,
  Shelter,
  TrafficData,
  Zone,
} from "./types";

const zones = zonesData as Zone[];
const shelters = sheltersData as Shelter[];
const roads = roadsData as unknown as RoadsByRef;
const fireStations = stationsData as { id: string; name: string; location: [number, number] }[];
const hazards: Hazard[] = [hazardData as Hazard];
const traffic = trafficData as TrafficData;

const REF_ALIASES: Record<string, string> = {
  "highway 12": "CA 12",
  "hwy 12": "CA 12",
  "ca 12": "CA 12",
  "route 12": "CA 12",
  "highway 101": "US 101",
  "hwy 101": "US 101",
  "us 101": "US 101",
  "101": "US 101",
};

function buildAssignments(zoneList: Zone[], shelterList: Shelter[]): Assignment[] {
  const remainingCapacity = new Map(shelterList.map((s) => [s.id, s.capacity]));
  const assignments: Assignment[] = [];

  const priority = [...zoneList].sort((a, b) => {
    const statusWeight: Record<string, number> = { critical: 3, evacuating: 2, "at-risk": 1, clear: 0 };
    return statusWeight[b.status] - statusWeight[a.status] || b.population - a.population;
  });

  for (const zone of priority) {
    const zoneCenter = centroid(zone.boundary);
    let people = zone.population;
    const candidates = [...shelterList].sort(
      (a, b) => haversineKm(zoneCenter, a.location) - haversineKm(zoneCenter, b.location)
    );
    for (const shelter of candidates) {
      if (people <= 0) break;
      const capacity = remainingCapacity.get(shelter.id) ?? 0;
      if (capacity <= 0) continue;
      const assigned = Math.min(capacity, people);
      remainingCapacity.set(shelter.id, capacity - assigned);
      people -= assigned;
      assignments.push({
        zoneId: zone.id,
        zoneName: zone.name,
        shelterId: shelter.id,
        shelterName: shelter.name,
        people: assigned,
        coordinates: [zoneCenter, shelter.location],
      });
    }
  }
  return assignments;
}

function buildAmbulances(zoneList: Zone[]): Ambulance[] {
  const priorityZones = zoneList.filter((z) => z.status === "critical" || z.status === "evacuating").slice(0, 6);
  return priorityZones.map((zone, i) => {
    const zoneCenter = centroid(zone.boundary);
    const station = [...fireStations].sort(
      (a, b) => haversineKm(zoneCenter, a.location) - haversineKm(zoneCenter, b.location)
    )[0];
    return {
      id: `Ambulance ${i + 1}`,
      stationId: station.id,
      stationName: station.name,
      destinationZoneId: zone.id,
      destinationZoneName: zone.name,
      coordinates: [station.location, zoneCenter],
    };
  });
}

function computeMetrics(zoneList: Zone[], shelterList: Shelter[], assignments: Assignment[], ambulances: Ambulance[]): Metrics {
  const assignedByShelter = new Map<string, number>();
  for (const a of assignments) {
    assignedByShelter.set(a.shelterId, (assignedByShelter.get(a.shelterId) ?? 0) + a.people);
  }
  return {
    totalPopulation: zoneList.reduce((sum, z) => sum + z.population, 0),
    zonesEvacuating: zoneList.filter((z) => z.status === "evacuating").length,
    zonesCritical: zoneList.filter((z) => z.status === "critical").length,
    totalShelterCapacity: shelterList.reduce((sum, s) => sum + s.capacity, 0),
    shelterCapacityAssigned: [...assignedByShelter.values()].reduce((sum, v) => sum + v, 0),
    activeAmbulances: ambulances.length,
  };
}

export function getInitialScenario(): ScenarioState {
  const assignments = buildAssignments(zones, shelters);
  const ambulances = buildAmbulances(zones);
  return {
    zones,
    shelters,
    roads,
    fireStations,
    hazards,
    traffic,
    assignments,
    ambulances,
    incidents: [],
    blockedRoads: [],
    metrics: computeMetrics(zones, shelters, assignments, ambulances),
  };
}

export function applyIncidentText(scenario: ScenarioState, text: string): ScenarioState {
  const parsed = parseIncident(text, zones);

  let nextZones = scenario.zones;
  const nextBlockedRoads: BlockedRoad[] = [...scenario.blockedRoads];

  for (const ref of parsed.blockedRoadRefs) {
    const normalizedRef = REF_ALIASES[ref.toLowerCase()] ?? ref.toUpperCase();
    const segments = roads[normalizedRef];
    if (!segments || nextBlockedRoads.some((b) => b.roadRef === normalizedRef)) continue;
    for (const segment of segments) {
      nextBlockedRoads.push({
        id: `blocked-${segment.id}`,
        roadRef: normalizedRef,
        name: segment.name,
        reason: parsed.description,
        coordinates: segment.coordinates,
      });
    }
  }

  if (parsed.zoneName || parsed.type === "fire-spread") {
    nextZones = scenario.zones.map((zone) => {
      const matchesZone = parsed.zoneName && zone.name.toLowerCase().includes(parsed.zoneName.toLowerCase());
      if (!matchesZone && parsed.type !== "fire-spread") return zone;
      if (parsed.type === "injuries" && matchesZone) return { ...zone, status: "critical" };
      if (parsed.type === "fire-spread" || matchesZone) {
        if (zone.status === "clear") return { ...zone, status: "at-risk" };
        if (zone.status === "at-risk") return { ...zone, status: "evacuating" };
      }
      return zone;
    });
  }

  const assignments = buildAssignments(nextZones, scenario.shelters);
  const ambulances = buildAmbulances(nextZones);

  const incident: Incident = {
    id: `incident-${Date.now()}`,
    type: parsed.type,
    description: parsed.description,
    severity: parsed.severity,
    timestamp: new Date().toISOString(),
    zoneId: nextZones.find((z) => parsed.zoneName && z.name.toLowerCase().includes(parsed.zoneName.toLowerCase()))?.id,
  };

  return {
    ...scenario,
    zones: nextZones,
    blockedRoads: nextBlockedRoads,
    assignments,
    ambulances,
    incidents: [incident, ...scenario.incidents],
    metrics: computeMetrics(nextZones, scenario.shelters, assignments, ambulances),
  };
}
