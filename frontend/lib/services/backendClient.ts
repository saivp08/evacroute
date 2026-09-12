// Thin client for the live EvacRoute FastAPI backend (see backend/app/main.py).
//
// Only the fields dataService.ts actually reads are declared here — this is not a full
// mirror of backend/app/models. Coordinates arrive as [latitude, longitude] tuples per the
// backend's public contract (see backend/API.md).
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export type BackendCoordinate = [number, number];

interface BackendSite {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface BackendZone extends BackendSite {
  population: number;
  boundary: BackendCoordinate[][];
}

export interface BackendShelter extends BackendSite {
  capacity: number;
  current_occupancy: number;
  status: string;
  planning_available: boolean;
  address: string | null;
}

export interface BackendEmergencyResource extends BackendSite {
  type: "ambulance" | "rescue_team";
  availability_status: "available" | "unavailable";
}

export interface BackendRoad {
  id: string;
  name: string;
  road_type: string;
  coordinates: BackendCoordinate[];
}

export interface BackendScenario {
  scenario: {
    name: string;
    node_count: number;
    edge_count: number;
    data_mode: string;
    data_note: string;
    center: BackendCoordinate;
  };
  zones: BackendZone[];
  shelters: BackendShelter[];
  roads: BackendRoad[];
  emergency_resources: BackendEmergencyResource[];
}

export interface BackendActiveIncident {
  id: string;
  type: string;
  severity: "low" | "medium" | "high";
  affected_edge_ids: string[];
  zone: string | null;
  latitude: number | null;
  longitude: number | null;
  injuries: number | null;
}

export interface BackendResponderRoute {
  id: string;
  name: string;
  type: "ambulance" | "rescue_team";
  destination: string;
  incident_id: string;
  travel_time_s: number;
  distance_m: number;
  coordinates: BackendCoordinate[];
}

export interface BackendEvacuationRoute {
  id: string;
  zone: string;
  zone_name: string;
  shelter: string;
  shelter_name: string;
  people: number;
  travel_time_s: number;
  coordinates: BackendCoordinate[];
}

export interface BackendPlan {
  evacuation_routes: BackendEvacuationRoute[];
  incidents: BackendActiveIncident[];
  ambulances: BackendResponderRoute[];
  rescue_teams: BackendResponderRoute[];
  metrics: {
    total_evacuees: number;
    assigned_evacuees: number;
    average_effective_travel_time_s: number;
    average_effective_emergency_response_time_s: number;
    uncovered_injuries: number;
    unfilled_rescue_requests: number;
  };
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, init);
  if (!res.ok) {
    throw new Error(`EvacRoute backend request failed: ${path} (${res.status})`);
  }
  return res.json();
}

export function getHealth() {
  return fetchJson<{ status: string }>("/health");
}

// Nearly every getX() in dataService.ts needs the scenario, the active incidents, and the
// optimized plan together, so one in-flight request is shared across all of them instead of
// each panel triggering its own /scenario + /optimize round trip. Cached for the page's
// lifetime — there's no manual refresh action yet.
let statePromise: Promise<{ scenario: BackendScenario; plan: BackendPlan }> | null = null;

export function getBackendState() {
  if (!statePromise) {
    statePromise = Promise.all([
      fetchJson<BackendScenario>("/scenario"),
      fetchJson<BackendPlan>("/optimize", { method: "POST" }),
    ]).then(([scenario, plan]) => ({ scenario, plan }));
  }
  return statePromise;
}
