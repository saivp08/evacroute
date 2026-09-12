// Core data shapes for the EvacRoute command-center UI.
// Everything here is backed by real public data (see lib/data/*.json and scripts/fetch-data.mjs) —
// there is no backend and no mock data. "Assignment"/"ambulance" positions are computed
// client-side with simple nearest-available matching, not a road-network router.

export type LatLng = [number, number];

export type ZoneStatus = "clear" | "at-risk" | "evacuating" | "critical";

export interface Zone {
  id: string;
  name: string;
  population: number;
  vulnerablePct: number;
  status: ZoneStatus;
  boundary: LatLng[];
}

export interface Shelter {
  id: string;
  name: string;
  address: string;
  location: LatLng;
  capacity: number;
}

export interface RoadSegment {
  id: string;
  name: string;
  coordinates: LatLng[];
}

// Keyed by road ref, e.g. "CA 12", "US 101" — see lib/data/roads.json.
export type RoadsByRef = Record<string, RoadSegment[]>;

export interface FireStation {
  id: string;
  name: string;
  location: LatLng;
}

export interface Hazard {
  id: string;
  name: string;
  type: string;
  location: LatLng;
  startedAt: string;
  containedAt: string;
  acresBurned: number;
  radiusMeters: number;
  note: string;
}

export interface TrafficPoint {
  time?: string;
  minuteOfDay?: number;
  avgSpeedKmh: number | null;
  avgFlowVehPerHr: number | null;
}

export interface TrafficData {
  corridor: string;
  source: string;
  detectorCount: number;
  intervalMinutes: number;
  evacuation: TrafficPoint[];
  routineByTimeOfDay: TrafficPoint[];
}

// A zone -> shelter assignment, drawn on the map as a straight connector (not a routed path).
export interface Assignment {
  zoneId: string;
  zoneName: string;
  shelterId: string;
  shelterName: string;
  people: number;
  coordinates: LatLng[];
}

export interface Ambulance {
  id: string;
  stationId: string;
  stationName: string;
  destinationZoneId: string;
  destinationZoneName: string;
  coordinates: LatLng[];
}

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export interface Incident {
  id: string;
  type: string;
  description: string;
  severity: IncidentSeverity;
  timestamp: string;
  zoneId?: string;
}

export interface BlockedRoad {
  id: string;
  roadRef: string;
  name: string;
  reason: string;
  coordinates: LatLng[];
}

export interface Metrics {
  totalPopulation: number;
  zonesEvacuating: number;
  zonesCritical: number;
  totalShelterCapacity: number;
  shelterCapacityAssigned: number;
  activeAmbulances: number;
}

export interface ScenarioState {
  zones: Zone[];
  shelters: Shelter[];
  roads: RoadsByRef;
  fireStations: FireStation[];
  hazards: Hazard[];
  traffic: TrafficData;
  assignments: Assignment[];
  ambulances: Ambulance[];
  incidents: Incident[];
  blockedRoads: BlockedRoad[];
  metrics: Metrics;
}

export interface ParsedIncident {
  type: "road-blocked" | "injuries" | "fire-spread" | "general";
  description: string;
  severity: IncidentSeverity;
  zoneName?: string;
  blockedRoadRefs: string[];
}
