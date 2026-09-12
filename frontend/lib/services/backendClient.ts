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

export class BackendRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, init);
  if (!res.ok) {
    // The backend returns a structured {error: {code, message}} body on 4xx/5xx (see
    // backend/app/main.py's exception handlers) — surface that real message (e.g. "OpenAI
    // is not configured") instead of a generic status-code string.
    let message = `EvacRoute backend request failed: ${path} (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.error?.message === "string") message = body.error.message;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new BackendRequestError(message, res.status);
  }
  return res.json();
}

export interface BackendParseResponse extends BackendPlan {
  applied_events: unknown[];
  notes: string[];
}

// Natural-language incident report -> backend/app/openai's structured extraction + replan
// (POST /incident/parse). Requires OPEN_AI_API_KEY to be configured on the backend; if it
// isn't, the backend itself returns a real, honest error which this surfaces as-is.
export function submitIncidentReport(report: string) {
  return fetchJson<BackendParseResponse>("/incident/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report }),
  });
}

export function getHealth() {
  return fetchJson<{ status: string }>("/health");
}

// Clears every active incident back to the real scenario baseline (POST /incidents/reset) —
// used by the demo-cycle loop once a seeded incident's real responder has actually reached
// it, so the next seeded incident starts from a clean, real state rather than layering on
// top of a resolved one.
export function resetIncidents() {
  return fetchJson<BackendPlan>("/incidents/reset", { method: "POST" });
}

// Removes exactly one active incident (e.g. once its real dispatched responder has actually
// reached it) — other concurrently active incidents are untouched. POST /incident/{id}/resolve.
export function resolveIncident(incidentId: string) {
  return fetchJson<BackendPlan>(`/incident/${encodeURIComponent(incidentId)}/resolve`, { method: "POST" });
}

export type AssistantReferenceKind = "vehicle" | "incident" | "closure" | "shelter" | "zone";

export interface AssistantReference {
  kind: AssistantReferenceKind;
  id: string;
  label: string;
}

export interface AssistantChatResult {
  reply: string;
  references: AssistantReference[];
}

export interface AssistantChatTurn {
  role: "user" | "assistant";
  content: string;
}

export function sendAssistantMessage(message: string, history: AssistantChatTurn[]) {
  return fetchJson<AssistantChatResult>("/assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
}

export type IncidentImageType = "FIRE" | "FLOOD" | "ROAD_CLOSURE" | "CRASH" | "MEDICAL_EMERGENCY" | "WILDFIRE" | "HAZARDOUS_MATERIAL" | "OTHER";
export type IncidentImageSeverity = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export interface ImageAnalysisResult {
  incident_type: IncidentImageType;
  severity: IncidentImageSeverity | null;
  description: string;
  affected_road: string | null;
  estimated_people_affected: number | null;
  environmental_conditions: string[];
  confidence: { incident_type: number; severity: number };
}

export function analyzeIncidentImage(imageBase64: string, mimeType: string, contextText: string) {
  return fetchJson<ImageAnalysisResult>("/incident/analyze-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64: imageBase64, mime_type: mimeType, context_text: contextText || null }),
  });
}

// Nearly every getX() in dataService.ts needs the scenario, the active incidents, and the
// optimized plan together, so one in-flight request is shared across all of them instead of
// each panel triggering its own /scenario + /optimize round trip.
//
// Cached until explicitly invalidated (see invalidateBackendState) rather than for the
// page's whole lifetime — lib/useLiveEvents.ts invalidates it once per poll cycle so the
// entire app (rails, map layers, and the live-events diff engine) can actually observe
// real backend changes (a POST /incident, a shelter occupancy update, etc.) instead of
// forever replaying the snapshot captured on first load.
let statePromise: Promise<{ scenario: BackendScenario; plan: BackendPlan }> | null = null;

export function invalidateBackendState() {
  statePromise = null;
}

export function getBackendState() {
  if (!statePromise) {
    statePromise = Promise.all([
      fetchJson<BackendScenario>("/scenario"),
      fetchJson<BackendPlan>("/optimize", { method: "POST" }),
    ]).then(([scenario, plan]) => ({ scenario, plan }));
  }
  return statePromise;
}
