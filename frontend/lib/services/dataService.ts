import type { ActiveIncident, IncidentRequest, ParseResponse, PlanResponse, ScenarioResponse } from "./apiTypes";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method, cache: "no-store",
      ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error("Cannot reach the backend. Check that it is running and retry. If a submission lost its connection, run optimization to refresh the current state before resubmitting.");
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.error ?? payload?.detail;
    const message = typeof detail?.message === "string" ? detail.message : `Request failed (HTTP ${response.status}).`;
    throw new Error(message);
  }
  if (payload === null) throw new Error("The backend returned an empty or invalid response.");
  return payload as T;
}

export const getHealth = () => request<{ status: string }>("/health");
export const getScenario = () => request<ScenarioResponse>("/scenario");
export const getIncidents = () => request<{ incidents: ActiveIncident[] }>("/incidents");
export const optimize = () => request<PlanResponse>("/optimize", "POST");
export const submitIncident = (incident: IncidentRequest) => request<PlanResponse>("/incident", "POST", incident);
export const parseReport = (report: string) => request<ParseResponse>("/incident/parse", "POST", { report });
export const resetIncidents = () => request<PlanResponse>("/incidents/reset", "POST");
