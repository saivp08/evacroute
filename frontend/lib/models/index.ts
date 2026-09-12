// UI view models. Wire types and conversions live in lib/services.
export type LatLng = { latitude: number; longitude: number };

export type VehicleType = "ambulance" | "rescue_team" | "fire_engine" | "police_vehicle";
export type VehicleStatus = "available" | "assigned" | "en_route" | "on_scene" | "returning" | "out_of_service";
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

export type RoadStatus = "open" | "restricted" | "congested" | "blocked" | "closed";

export interface Road {
  id: string;
  name: string;
  status: RoadStatus;
  coordinates: LatLng[];
  closure_reason: string | null;
}

export type RouteStatus = "planned" | "active" | "completed" | "cancelled";

export interface Route {
  id: string;
  origin_zone_id: string;
  destination_shelter_id: string;
  status: RouteStatus;
  people_count: number;
  coordinates: LatLng[];
  eta_minutes: number | null;
}

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "reported" | "confirmed" | "responding" | "resolved";

export interface Incident {
  id: string;
  type: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  latitude: number | null;
  longitude: number | null;
  zone_id: string | null;
  reported_at: string | null;
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

export type EvacuationZoneStatus = "planned" | "unplanned" | "clear" | "advisory" | "warning" | "mandatory";

export interface EvacuationZone {
  id: string;
  name: string;
  status: EvacuationZoneStatus;
  population: number;
  boundary: LatLng[];
  boundaries?: LatLng[][];
  latitude?: number;
  longitude?: number;
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
