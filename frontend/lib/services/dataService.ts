// Data/service layer for EvacRoute.
//
//   Frontend component -> this service -> lib/services/backendClient -> live FastAPI backend
//
// Components must call these functions and never fetch the backend directly. Each function
// normalizes the backend's response shape (backend/app/models) into this app's own typed
// models (lib/models) so components never need to know about the backend's field names.
//
// Data integrity rule for this whole file: every getX() either returns data derived from
// an actual backend response, or returns an honest empty/absent value when the backend has
// no equivalent concept (hospitals, fire/police stations, hazards, field intel reports).
// Nothing here invents operational numbers to make a panel look populated — see
// getNetworkStatus below for why that even applies to something as "just visual" as a
// traffic summary.
import type {
  EvacuationZone,
  FireStation,
  Hazard,
  Hospital,
  Incident,
  IntelReport,
  LatLng,
  NetworkStatus,
  OperationsMetrics,
  PoliceStation,
  Road,
  RoadClosure,
  IncidentReportResult,
  Route,
  RouteUpdateEvent,
  Shelter,
  ShelterStatus,
  SystemStatus,
  Vehicle,
  VehicleRoute,
} from "../models";
import {
  getBackendState,
  getHealth,
  invalidateBackendState,
  resetIncidents as resetIncidentsOnBackend,
  resolveIncident as resolveIncidentOnBackend,
  submitIncidentReport as submitIncidentReportToBackend,
  type BackendCoordinate,
  type BackendResponderRoute,
  type BackendShelter,
} from "./backendClient";
import { buildDetour, routeLengthMiles } from "../routeMotion";

function toLatLngList(coordinates: BackendCoordinate[]): LatLng[] {
  return coordinates.map(([latitude, longitude]) => ({ latitude, longitude }));
}

function metersToMiles(meters: number): number {
  return meters / 1609.34;
}

function secondsToMinutes(seconds: number): number {
  return Math.round(seconds / 60);
}

function shelterStatus(shelter: BackendShelter): ShelterStatus {
  if (!shelter.planning_available || shelter.status.toUpperCase().includes("CLOSED")) return "closed";
  if (shelter.current_occupancy >= shelter.capacity) return "full";
  return "open";
}

export async function getVehicles(): Promise<Vehicle[]> {
  const { plan, scenario } = await getBackendState();
  const dispatched = new Map<string, BackendResponderRoute>(
    [...plan.ambulances, ...plan.rescue_teams].map((route) => [route.id, route])
  );

  return scenario.emergency_resources.map((resource) => {
    const route = dispatched.get(resource.id);
    return {
      id: resource.id,
      type: resource.type,
      callsign: resource.name,
      status: route ? "en_route" : resource.availability_status === "available" ? "available" : "out_of_service",
      latitude: resource.latitude,
      longitude: resource.longitude,
      destination: route ? route.destination : null,
      priority: route ? "critical" : "low",
      route: route ? toLatLngList(route.coordinates) : [],
      eta_minutes: route ? secondsToMinutes(route.travel_time_s) : null,
    };
  });
}

// No backend equivalent yet — these facility types aren't part of the scenario contract.
export async function getHospitals(): Promise<Hospital[]> {
  return [];
}

export async function getShelters(): Promise<Shelter[]> {
  const { scenario } = await getBackendState();
  return scenario.shelters.map((shelter) => ({
    id: shelter.id,
    type: "shelter",
    name: shelter.name,
    address: shelter.address ?? "",
    latitude: shelter.latitude,
    longitude: shelter.longitude,
    status: shelterStatus(shelter),
    capacity: shelter.capacity,
    occupancy: shelter.current_occupancy,
  }));
}

export async function getFireStations(): Promise<FireStation[]> {
  return [];
}

export async function getPoliceStations(): Promise<PoliceStation[]> {
  return [];
}

export async function getRoads(): Promise<Road[]> {
  const { scenario, plan } = await getBackendState();
  const closedEdgeIds = new Set(plan.incidents.flatMap((incident) => incident.affected_edge_ids));
  return scenario.roads.map((road) => ({
    id: road.id,
    name: road.name || road.road_type,
    status: closedEdgeIds.has(road.id) ? "closed" : "open",
    coordinates: toLatLngList(road.coordinates),
    closure_reason: closedEdgeIds.has(road.id) ? "Active incident on this segment" : null,
  }));
}

export async function getRoutes(): Promise<Route[]> {
  const { plan } = await getBackendState();
  return plan.evacuation_routes.map((route) => ({
    id: route.id,
    origin_zone_id: route.zone,
    destination_shelter_id: route.shelter,
    status: "active",
    people_count: route.people,
    coordinates: toLatLngList(route.coordinates),
    eta_minutes: secondsToMinutes(route.travel_time_s),
  }));
}

export async function getIncidents(): Promise<Incident[]> {
  const { scenario, plan } = await getBackendState();
  const zoneById = new Map(scenario.zones.map((zone) => [zone.id, zone]));
  return plan.incidents.map((incident) => {
    const zone = incident.zone ? zoneById.get(incident.zone) : undefined;
    return {
      id: incident.id,
      type: incident.type,
      description: `${incident.type.replace(/_/g, " ")} — ${incident.severity} severity`,
      severity: incident.severity,
      status: "confirmed",
      latitude: incident.latitude ?? zone?.latitude ?? scenario.scenario.center[0],
      longitude: incident.longitude ?? zone?.longitude ?? scenario.scenario.center[1],
      zone_id: incident.zone,
      reported_at: new Date().toISOString(),
    };
  });
}

// No backend equivalent — the scenario has no hazard-zone concept distinct from
// incidents/zones. Returns an honest empty list rather than invented hazard records; the
// Hazards map layer/panel render a genuine "no data" state for this.
export async function getHazards(): Promise<Hazard[]> {
  return [];
}

export async function getEvacuationZones(): Promise<EvacuationZone[]> {
  const { scenario, plan } = await getBackendState();
  // "mandatory" vs "advisory" is a real, backend-derived signal (does this zone currently
  // have an active incident against it?), not an invented label — every zone used to be
  // hardcoded to "mandatory" regardless of actual state, which this replaces.
  const zonesWithIncidents = new Set(plan.incidents.map((incident) => incident.zone).filter((id): id is string => id !== null));
  return scenario.zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    status: zonesWithIncidents.has(zone.id) ? "mandatory" : "advisory",
    population: zone.population,
    boundary: toLatLngList(zone.boundary[0] ?? []),
  }));
}

// Derived from real signals the backend actually reports (health check, loaded road
// network, data provenance) rather than invented subsystem names.
export async function getSystemStatuses(): Promise<SystemStatus[]> {
  const [health, { scenario }] = await Promise.all([getHealth(), getBackendState()]);
  return [
    {
      id: "backend-api",
      label: "Backend API",
      status: health.status === "ok" ? "operational" : "offline",
      detail: `EvacRoute FastAPI service — ${scenario.scenario.data_mode.replace(/_/g, " ")}`,
    },
    {
      id: "road-network",
      label: "Road Network",
      status: scenario.scenario.edge_count > 0 ? "operational" : "offline",
      detail: `${scenario.scenario.node_count} nodes / ${scenario.scenario.edge_count} edges loaded`,
    },
    {
      id: "public-data",
      label: "Public Data Feed",
      status: "operational",
      detail: scenario.scenario.data_note,
    },
  ];
}

// No backend equivalent yet — there is no field-report/analyst-intel source.
export async function getIntelReports(): Promise<IntelReport[]> {
  return [];
}

export async function getOperationsMetrics(): Promise<OperationsMetrics> {
  const { plan } = await getBackendState();
  const metrics = plan.metrics;
  const travelHours = metrics.average_effective_travel_time_s > 0 ? metrics.average_effective_travel_time_s / 3600 : null;
  return {
    evacuation_flow_per_hour: travelHours ? Math.round(metrics.assigned_evacuees / travelHours) : 0,
    avg_response_eta_minutes: Math.round(metrics.average_effective_emergency_response_time_s / 60),
    transportation_bottlenecks: metrics.uncovered_injuries + metrics.unfilled_rescue_requests,
  };
}

// Returns null for a vehicle with no active dispatch route (available/out-of-service) as
// well as for an unrecognized vehicle id — both are legitimate "no route to show" states.
export async function getVehicleRoute(vehicleId: string): Promise<VehicleRoute | null> {
  const { plan } = await getBackendState();
  const route = [...plan.ambulances, ...plan.rescue_teams].find((r) => r.id === vehicleId);
  if (!route) return null;
  const coordinates = toLatLngList(route.coordinates);
  return {
    vehicle_id: vehicleId,
    origin: coordinates[0],
    destination_name: route.destination,
    destination: coordinates[coordinates.length - 1],
    coordinates,
    distance_miles: metersToMiles(route.distance_m),
    eta_minutes: secondsToMinutes(route.travel_time_s),
    status: "clear",
    priority: "critical",
  };
}

export async function getRoadClosures(): Promise<RoadClosure[]> {
  const { scenario, plan } = await getBackendState();
  const roadById = new Map(scenario.roads.map((road) => [road.id, road]));
  const CLOSURE_TYPES = new Set(["ROAD_CLOSURE", "ROAD_DAMAGE", "DEBRIS", "HAZARD_UPDATE"]);
  return plan.incidents
    .filter((incident) => CLOSURE_TYPES.has(incident.type))
    .map((incident) => {
      const roadId = incident.affected_edge_ids[0] ?? null;
      const road = roadId ? roadById.get(roadId) : undefined;
      return {
        id: incident.id,
        road_id: roadId,
        road_name: road?.name || "Unnamed road",
        reason: incident.type.replace(/_/g, " ").toLowerCase(),
        severity: incident.severity,
        reported_at: new Date().toISOString(),
        coordinates: road ? toLatLngList(road.coordinates) : [],
        status: "closed",
      };
    });
}

// Frontend-only "SIMULATE CLOSURE" demo control, explicitly and visibly triggered by the
// operator (a button, not ambient state): the live backend has no closure/reroute concept
// for a dispatched vehicle, so this is a deterministic geometric detour layered on top of
// whichever route the vehicle actually has right now. Same vehicle + same route always
// produces the same detour — see buildDetour in lib/routeMotion.ts. Kept isolated from the
// real-data event stream/alerts (lib/useLiveEvents.ts): this demo's fixed message never
// feeds into anything presented as an organic backend event.
export async function getRerouteEvent(vehicleId: string): Promise<RouteUpdateEvent | null> {
  const route = await getVehicleRoute(vehicleId);
  if (!route) return null;

  const detour = buildDetour(route.coordinates);
  if (!detour) return null;

  return {
    vehicle_id: vehicleId,
    closure_id: `${vehicleId}-mock-closure`,
    message: "Route updated — Bridge Road closed due to debris.",
    closure_point: detour.closurePoint,
    alternate_coordinates: detour.coordinates,
    alternate_distance_miles: routeLengthMiles(detour.coordinates),
    alternate_eta_minutes: Math.max(1, Math.round(route.eta_minutes * 1.3)),
  };
}

// Real network-health snapshot: percentages/counts computed here in the frontend from the
// actual per-road status getRoads() already derives from backend incident data — never a
// fixed/invented distribution. The backend currently only distinguishes open vs. closed at
// the road level (see getRoads above), so that's all this reports.
export async function getNetworkStatus(): Promise<NetworkStatus> {
  const roads = await getRoads();
  const closed_count = roads.filter((road) => road.status !== "open").length;
  const open_count = roads.length - closed_count;
  const total_roads = roads.length;
  return {
    total_roads,
    open_count,
    closed_count,
    open_percent: total_roads > 0 ? Math.round((open_count / total_roads) * 100) : 0,
    closed_percent: total_roads > 0 ? Math.round((closed_count / total_roads) * 100) : 0,
  };
}

// Submits a free-text incident report for the backend to parse and apply (POST
// /incident/parse — requires OPEN_AI_API_KEY on the backend; if unset, the backend's own
// real error propagates as-is, never a fabricated success). Every count in the returned
// summary is read directly off that response: applied_events.length (structured incidents
// the backend actually accepted) and the post-replan ambulances/rescue_teams dispatched —
// never a computed "N routes changed" delta, since a single response can't honestly derive
// that without the caller's own before/after diff.
export async function submitIncidentReport(report: string): Promise<IncidentReportResult> {
  const result = await submitIncidentReportToBackend(report);
  invalidateBackendState();
  // The backend appends newly-applied incidents to the end of its active-incident list and
  // never reorders it, so the last `applied_events.length` entries are exactly the ones this
  // request just created — real ids read off the response, not guessed.
  const newIncidentIds = result.applied_events.length > 0
    ? result.incidents.slice(-result.applied_events.length).map((incident) => incident.id)
    : [];
  return {
    appliedIncidentCount: result.applied_events.length,
    ambulancesDispatched: result.ambulances.length,
    rescueTeamsDispatched: result.rescue_teams.length,
    notes: result.notes,
    newIncidentIds,
  };
}

export async function resetIncidents(): Promise<void> {
  await resetIncidentsOnBackend();
  invalidateBackendState();
}

export async function resolveIncident(incidentId: string): Promise<void> {
  await resolveIncidentOnBackend(incidentId);
  invalidateBackendState();
}
