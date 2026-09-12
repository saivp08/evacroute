// FastAPI wire contract. Coordinate pairs stay [latitude, longitude].
export type Coordinate = [number, number];
export type IncidentType = "ROAD_CLOSURE" | "ROAD_REOPEN" | "HAZARD_UPDATE" | "ROAD_DAMAGE" | "DEBRIS" | "MEDICAL_INCIDENT" | "RESCUE_INCIDENT";
export type Severity = "low" | "medium" | "high";
interface Site { id: string; name: string; latitude: number; longitude: number }
export interface ScenarioResponse {
  scenario: { name: string; center: Coordinate; data_note: string; coordinate_order: string };
  roads: { id: string; name: string; coordinates: Coordinate[] }[];
  zones: (Site & { population: number; boundary: Coordinate[][] })[];
  shelters: (Site & { capacity: number; current_occupancy: number; planning_available: boolean; address: string | null })[];
  emergency_resources: (Site & { type: "ambulance" | "rescue_team"; availability_status: "available" | "unavailable"; response_capacity: number })[];
}
export interface ActiveIncident {
  id: string; type: IncidentType; severity: Severity; affected_edge_ids: string[];
  zone: string | null; latitude: number | null; longitude: number | null; injuries: number | null;
}
export interface IncidentRequest {
  type: IncidentType; edge_id?: string; edge_ids?: string[]; road_name?: string;
  latitude?: number; longitude?: number; severity?: Severity; zone?: string; injuries?: number;
}
export interface EvacuationRoute {
  id: string; zone: string; zone_name: string; shelter: string; shelter_name: string;
  people: number; effective_travel_time_s: number; coordinates: Coordinate[]; edge_ids: string[];
}
export interface ResponderRoute {
  id: string; name: string; type: "ambulance" | "rescue_team"; destination: string;
  incident_id: string; effective_travel_time_s: number; coordinates: Coordinate[]; edge_ids: string[];
}
export interface PlanResponse {
  evacuation_routes: EvacuationRoute[];
  shelter_assignments: { shelter: string; assigned_people: number; remaining_capacity_after_assignment: number }[];
  incidents: ActiveIncident[]; ambulances: ResponderRoute[]; rescue_teams: ResponderRoute[];
  dispatch_summary: { incident_id: string; status: "covered" | "partial" | "unserved"; uncovered_injuries: number; unfilled_rescue_requests: number }[];
  metrics: {
    total_evacuees: number; assigned_evacuees: number; total_available_shelter_capacity: number;
    average_effective_travel_time_s: number; average_effective_emergency_response_time_s: number;
    ambulances_dispatched: number; rescue_teams_dispatched: number;
    uncovered_injuries: number; unfilled_rescue_requests: number;
  };
}
export interface ParseResponse extends PlanResponse {
  parser: "openai"; original_report: string;
  parsed_events: { type: IncidentType; certainty: "confirmed" | "uncertain"; evidence: string }[];
  notes: string[];
}
