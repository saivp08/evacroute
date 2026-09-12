// Typed entity models for EvacRoute.
//
// These describe the shape the FastAPI backend is expected to return (snake_case fields,
// flat latitude/longitude, string status enums) — see backend/app/models, currently empty.
// There is no backend yet, so these are authored here first; when the backend adds real
// Pydantic models, reconcile field-for-field with whatever it actually returns.
//
// Nothing outside lib/services should import from here directly for data VALUES — only
// for these types. Actual data comes from lib/services/dataService.ts.

export type LatLng = { latitude: number; longitude: number };

export type VehicleType = "ambulance" | "fire_engine" | "police_vehicle" | "rescue_team";
export type VehicleStatus = "available" | "en_route" | "on_scene" | "returning" | "out_of_service";
export type VehiclePriority = "low" | "medium" | "high" | "critical";

export interface Vehicle {
  id: string;
  type: VehicleType;
  callsign: string;
  status: VehicleStatus;
  latitude: number;
  longitude: number;
  destination: string | null;
  priority: VehiclePriority;
  route: LatLng[];
  eta_minutes: number | null;
}

export type FacilityStatus = "operational" | "limited" | "offline";

export interface Hospital {
  id: string;
  type: "hospital";
  name: string;
  latitude: number;
  longitude: number;
  status: FacilityStatus;
  trauma_level: number | null;
  bed_capacity: number;
  beds_available: number;
}

export type ShelterStatus = "open" | "full" | "closed";

export interface Shelter {
  id: string;
  type: "shelter";
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  status: ShelterStatus;
  capacity: number;
  occupancy: number;
}

export interface FireStation {
  id: string;
  type: "fire_station";
  name: string;
  latitude: number;
  longitude: number;
  status: FacilityStatus;
  jurisdiction: string;
}

export interface PoliceStation {
  id: string;
  type: "police_station";
  name: string;
  latitude: number;
  longitude: number;
  status: FacilityStatus;
  jurisdiction: string;
}

// Union of every entity that appears as an infrastructure marker on the map. Discriminated
// by `type`, so a single map layer can render/style all four consistently.
export type InfrastructureAsset = Hospital | Shelter | FireStation | PoliceStation;

export type RoadStatus = "open" | "congested" | "blocked" | "closed";

export interface Road {
  id: string;
  name: string;
  status: RoadStatus;
  coordinates: LatLng[];
  closure_reason: string | null;
}

export type RoadClosureStatus = "closed" | "reopened";

// A discrete closure EVENT — richer than Road.status (which is just the road's current
// state): this carries severity/timestamp/geometry so it can be listed, selected, and
// centered on independently, the way an incident can. `road_id` links back to the Road
// entity when the closure corresponds to a mapped segment, but is optional since not every
// closure needs a full Road entry to exist. Fetched via getRoadClosures() — purely a visual
// event state; no route avoidance or rerouting is computed from it.
export interface RoadClosure {
  id: string;
  road_id: string | null;
  road_name: string;
  reason: string;
  severity: IncidentSeverity;
  reported_at: string;
  coordinates: LatLng[];
  status: RoadClosureStatus;
}

export type RouteStatus = "planned" | "active" | "completed" | "cancelled";

// Evacuation route: civilian flow from a zone to a shelter (see EvacuationStatusPanel /
// ShelterCapacityPanel). Distinct from VehicleRoute below, which is a single emergency
// vehicle's dispatch route to an incident/facility — different domain, different shape.
export interface Route {
  id: string;
  origin_zone_id: string;
  destination_shelter_id: string;
  status: RouteStatus;
  people_count: number;
  coordinates: LatLng[];
  eta_minutes: number | null;
}

export type VehicleRouteStatus = "clear" | "congested" | "blocked" | "completed";

// A single emergency vehicle's current dispatch route. Fetched via getVehicleRoute(vehicle_id)
// — kept separate from Vehicle itself (which only carries a bare coordinate path for the
// map's movement animation) so route-specific data has one clear source once a backend
// route API exists.
export interface VehicleRoute {
  vehicle_id: string;
  origin: LatLng;
  destination_name: string;
  destination: LatLng;
  coordinates: LatLng[];
  distance_miles: number;
  eta_minutes: number;
  status: VehicleRouteStatus;
  priority: VehiclePriority;
}

// A predetermined mock alternate route: what a vehicle's route becomes if the referenced
// closure is simulated. Fetched via getRerouteEvent(vehicle_id) — a vehicle with no active
// route simply has no reroute scenario defined, which is a normal state, not an error.
// This is a deterministic geometric detour derived from the vehicle's own route, not
// computed pathfinding — see buildRerouteEvent in lib/services/dataService.ts.
export interface RouteUpdateEvent {
  vehicle_id: string;
  closure_id: string;
  message: string;
  // Where the mock closure marker is drawn on the map — the point on the ORIGINAL route
  // where the detour begins.
  closure_point: LatLng;
  alternate_coordinates: LatLng[];
  alternate_distance_miles: number;
  alternate_eta_minutes: number;
}

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "reported" | "confirmed" | "responding" | "resolved";

export interface Incident {
  id: string;
  type: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  latitude: number;
  longitude: number;
  zone_id: string | null;
  reported_at: string;
}

export type HazardType = "wildfire" | "flood" | "hurricane" | "earthquake" | "other";

export interface Hazard {
  id: string;
  type: HazardType;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  severity: IncidentSeverity;
  started_at: string;
}

export type EvacuationZoneStatus = "clear" | "advisory" | "warning" | "mandatory";

export interface EvacuationZone {
  id: string;
  name: string;
  status: EvacuationZoneStatus;
  population: number;
  boundary: LatLng[];
}

export type ZoneEvacuationStatus = "evacuate_now" | "evacuation_in_progress" | "monitored" | "clear";
export type ZoneHazardLevel = "extreme" | "high" | "moderate" | "low";
export type ZonePriority = "critical" | "high" | "medium" | "low";

// Richer operational record for the dedicated Evacuation Zones page (Phase 8) — distinct
// from EvacuationZone above, which only feeds the Overview's compact status list. Fetched
// via getEvacuationZoneDetails(): deterministic mock only, since neither the live backend
// nor EvacuationZone models this granularity (status/hazard/priority/evacuation plan).
export interface EvacuationZoneDetail {
  id: string;
  name: string;
  status: ZoneEvacuationStatus;
  priority: ZonePriority;
  hazard_level: ZoneHazardLevel;
  population: number;
  evacuated_percent: number;
  recommended_shelter_id: string;
  recommended_shelter_name: string;
  shelter_location: LatLng;
  boundary: LatLng[];
  centroid: LatLng;
  plan_distance_miles: number;
  plan_eta_minutes: number;
}

// The following are operations-console concepts (platform health, analyst reports,
// aggregate metrics) rather than physical entities — the backend may not model them the
// same way, but they still flow through the service layer like everything else here.

export type SystemStatusLevel = "operational" | "degraded" | "offline";

export interface SystemStatus {
  id: string;
  label: string;
  status: SystemStatusLevel;
  detail: string;
}

export type IntelConfidence = "low" | "medium" | "high";

export interface IntelReport {
  id: string;
  source: string;
  summary: string;
  confidence: IntelConfidence;
  reported_at: string;
}

export interface OperationsMetrics {
  evacuation_flow_per_hour: number;
  avg_response_eta_minutes: number;
  transportation_bottlenecks: number;
}
