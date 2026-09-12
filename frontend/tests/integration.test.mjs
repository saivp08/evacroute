import test from "node:test";
import assert from "node:assert/strict";
import { normalizeScenario, validCoordinate } from "../lib/services/normalize.ts";
import { getScenario, getIncidents, optimize, parseReport, resetIncidents, submitIncident } from "../lib/services/dataService.ts";

const coordinates = [[38.44, -122.71], [38.45, -122.72]];
const scenario = {
  scenario: { center: coordinates[0] },
  roads: [{ id: "1:2:0", name: "College Avenue", coordinates }],
  zones: [{ id: "zone-c", name: "Zone C", population: 20, latitude: 38.44, longitude: -122.71,
    boundary: [[...coordinates, [38.46, -122.73]], [[38.47, -122.74], [38.48, -122.75], [38.49, -122.76]]] }],
  shelters: [{ id: "fema-42", name: "Shelter", latitude: 38.45, longitude: -122.72, capacity: 30, current_occupancy: 5, planning_available: true, address: null },
    { id: "fema-closed", name: "Closed", latitude: 38.45, longitude: -122.72, capacity: 30, current_occupancy: 0, planning_available: false, address: null }],
  emergency_resources: [{ id: "rescue-1", name: "Rescue 1", type: "rescue_team", latitude: 38.44, longitude: -122.71, availability_status: "available" }],
};
const baseline = { incidents: [], ambulances: [], rescue_teams: [],
  evacuation_routes: [{ id: "route-zone-c-fema-42", zone: "zone-c", shelter: "fema-42", people: 20, coordinates, effective_travel_time_s: 120 }],
  shelter_assignments: [{ shelter: "fema-42", assigned_people: 20 }] };

test("maps real IDs, lat/lon, all boundaries, shelter occupancy and planning availability", () => {
  const data = normalizeScenario(scenario, baseline);
  assert.deepEqual(data.center, [38.44, -122.71]);
  assert.deepEqual(data.roads[0].coordinates[0], { latitude: 38.44, longitude: -122.71 });
  assert.equal(data.zones[0].boundaries.length, 2);
  assert.equal(data.routes[0].destination_shelter_id, "fema-42");
  assert.equal(data.routes[0].eta_minutes, 2);
  assert.equal(data.shelters[0].occupancy, 25);
  assert.equal(data.shelters[1].status, "closed");
});
test("closures take priority over penalties; rescue routes join by resource ID; reset clears overlays", () => {
  const closure = { id: "closure", type: "ROAD_CLOSURE", severity: "high", affected_edge_ids: ["1:2:0"], latitude: null, longitude: null, zone: null };
  const hazard = { ...closure, id: "hazard", type: "HAZARD_UPDATE" };
  const medical = { id: "medical", type: "MEDICAL_INCIDENT", severity: "high", affected_edge_ids: [], latitude: 38.44, longitude: -122.71, zone: "zone-c", injuries: 12 };
  const plan = { ...baseline, incidents: [closure, hazard, medical], rescue_teams: [{ id: "rescue-1", incident_id: "medical", destination: "medical", coordinates, effective_travel_time_s: 90 }] };
  const data = normalizeScenario(scenario, plan);
  assert.equal(data.roads[0].status, "blocked");
  assert.equal(data.vehicles[0].type, "rescue_team");
  assert.equal(data.vehicles[0].status, "assigned");
  assert.equal(data.vehicles[0].eta_minutes, 1.5);
  assert.equal(data.incidents[0].latitude, 38.44);
  assert.equal(data.incidents[0].reported_at, null);
  assert.equal(normalizeScenario(scenario, { ...baseline, incidents: [hazard] }).roads[0].status, "restricted");
  const reset = normalizeScenario(scenario, baseline);
  assert.equal(reset.roads[0].status, "open");
  assert.equal(reset.vehicles[0].route.length, 0);
  assert.equal(reset.incidents.length, 0);
});
test("invalid geometry is omitted without bridging gaps; empty arrays and unknown incident location are safe", () => {
  assert.equal(validCoordinate([-122, 38]), false);
  assert.equal(validCoordinate([NaN, 38]), false);
  assert.equal(validCoordinate([null, null]), false);
  const empty = { ...scenario, roads: [{ ...scenario.roads[0], coordinates: [...coordinates, [999, 0]] }], zones: [], shelters: [], emergency_resources: [] };
  const data = normalizeScenario(empty, { ...baseline, evacuation_routes: [], incidents: [{ id: "unknown", type: "HAZARD_UPDATE", severity: "low", affected_edge_ids: [], latitude: null, longitude: null, zone: null }] });
  assert.deepEqual(data.roads, []);
  assert.deepEqual(data.vehicles, []);
  assert.equal(data.incidents[0].latitude, null);
});
test("API service uses exact backend methods and bodies; provider errors are surfaced without fallback", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, ...options }); return new Response("{}", { status: 200 }); };
  try {
    await getScenario(); await getIncidents(); await optimize(); await parseReport("College Avenue is closed.");
    await submitIncident({ type: "ROAD_CLOSURE", road_name: "College Avenue" }); await resetIncidents();
    assert.deepEqual(calls.map((c) => [new URL(c.url).pathname, c.method]), [["/scenario", "GET"], ["/incidents", "GET"], ["/optimize", "POST"], ["/incident/parse", "POST"], ["/incident", "POST"], ["/incidents/reset", "POST"]]);
    assert.deepEqual(JSON.parse(calls[3].body), { report: "College Avenue is closed." });
    assert.equal(calls[2].body, undefined);
    assert.equal(calls[3].headers.Authorization, undefined);
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: "openai_not_configured", message: "Set OPEN_AI_API_KEY" } }), { status: 503 });
    await assert.rejects(parseReport("test"), /Set OPEN_AI_API_KEY/);
    globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
    await assert.rejects(optimize(), /Cannot reach the backend/);
  } finally { globalThis.fetch = original; }
});
