import type { EvacuationZone, Incident, Road, Route, Shelter, Vehicle } from "../models";
import type { ActiveIncident, Coordinate, PlanResponse, ScenarioResponse } from "./apiTypes";

export function validCoordinate(value: unknown): value is Coordinate {
  return Array.isArray(value) && value.length === 2 &&
    typeof value[0] === "number" && Number.isFinite(value[0]) && Math.abs(value[0]) <= 90 &&
    typeof value[1] === "number" && Number.isFinite(value[1]) && Math.abs(value[1]) <= 180;
}
const point = ([latitude, longitude]: Coordinate) => ({ latitude, longitude });
// Never connect across an invalid point and invent a new road segment.
const path = (coordinates: Coordinate[]) => coordinates.every(validCoordinate) ? coordinates.map(point) : [];
const blocksRoad = (incident: ActiveIncident) => incident.type === "ROAD_CLOSURE" || (incident.type === "DEBRIS" && incident.severity === "high");

export function normalizeScenario(scenario: ScenarioResponse, plan: PlanResponse | null) {
  if (!validCoordinate(scenario.scenario.center)) throw new Error("The scenario has an invalid map center.");
  const active = plan?.incidents ?? [];
  const roadIncidents = new Map<string, ActiveIncident[]>();
  for (const incident of active) for (const id of incident.affected_edge_ids) {
    roadIncidents.set(id, [...(roadIncidents.get(id) ?? []), incident]);
  }
  const roads: Road[] = scenario.roads.map((road) => {
    const affected = roadIncidents.get(road.id) ?? [];
    return { ...road, coordinates: path(road.coordinates),
      status: affected.some(blocksRoad) ? "blocked" as const : affected.length ? "restricted" as const : "open" as const,
      closure_reason: affected.length ? affected.map((i) => i.type.replaceAll("_", " ")).join(", ") : null };
  }).filter((r) => r.coordinates.length >= 2);
  const shelters: Shelter[] = scenario.shelters.filter((s) => validCoordinate([s.latitude, s.longitude])).map((s) => {
    const assigned = plan?.shelter_assignments.find((a) => a.shelter === s.id)?.assigned_people ?? 0;
    const occupancy = s.current_occupancy + assigned;
    return { ...s, type: "shelter", address: s.address ?? "", occupancy,
      status: !s.planning_available ? "closed" : occupancy >= s.capacity ? "full" : "open" };
  });
  const zones: EvacuationZone[] = scenario.zones.filter((z) => validCoordinate([z.latitude, z.longitude])).map((z) => ({
    ...z, status: plan ? "planned" : "unplanned",
    boundary: path(z.boundary?.[0] ?? []), boundaries: (z.boundary ?? []).map(path).filter((ring) => ring.length >= 3),
  }));
  const responderRoutes = [...(plan?.ambulances ?? []), ...(plan?.rescue_teams ?? [])];
  const vehicles: Vehicle[] = (scenario.emergency_resources ?? []).filter((r) => validCoordinate([r.latitude, r.longitude])).map((r) => {
    const route = responderRoutes.find((v) => v.id === r.id);
    const incident = active.find((i) => i.id === route?.incident_id);
    return { ...r, callsign: r.name, status: route ? "assigned" : r.availability_status === "available" ? "available" : "out_of_service",
      destination: route?.destination ?? null, priority: incident?.severity ?? "low",
      route: path(route?.coordinates ?? []), eta_minutes: route ? Math.round(route.effective_travel_time_s / 6) / 10 : null };
  });
  const routes: Route[] = (plan?.evacuation_routes ?? []).map((r) => ({
    id: r.id, origin_zone_id: r.zone, destination_shelter_id: r.shelter, status: "planned" as const,
    people_count: r.people, coordinates: path(r.coordinates), eta_minutes: Math.round(r.effective_travel_time_s / 6) / 10,
  })).filter((r) => r.coordinates.length >= 2);
  const incidents: Incident[] = active.map((i) => {
    const location = validCoordinate([i.latitude, i.longitude]) ? [i.latitude!, i.longitude!] as Coordinate
      : scenario.roads.find((r) => i.affected_edge_ids.includes(r.id))?.coordinates.find(validCoordinate);
    return { ...i, latitude: location?.[0] ?? null, longitude: location?.[1] ?? null,
      description: `${i.type.replaceAll("_", " ")}${i.injuries ? `: ${i.injuries} injured` : ""}${i.zone ? ` (${i.zone})` : ""}`,
      status: responderRoutes.some((r) => r.incident_id === i.id) ? "responding" : "confirmed",
      zone_id: i.zone, reported_at: null };
  });
  return { center: scenario.scenario.center, roads, zones, shelters, vehicles, routes, incidents };
}
