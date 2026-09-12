"""Severity-first greedy dispatch using the same dynamic paths as evacuation."""

import networkx as nx

from app.models.emergency import DispatchSummary, EmergencyMetrics, ResponderRoute
from app.models.incidents import ActiveIncident, IncidentPlan
from app.models.scenario import ScenarioResponse
from app.optimization.evacuation import optimize_evacuation
from app.routing.shortest_paths import compute_shortest_paths


def plan_transportation(graph: nx.MultiDiGraph, scenario: ScenarioResponse,
                        incidents: list[ActiveIncident]) -> IncidentPlan:
    evacuation = optimize_evacuation(graph, scenario)
    medical = sorted((i for i in incidents if i.type == "MEDICAL_INCIDENT"),
                     key=lambda i: ({"high": 0, "medium": 1, "low": 2}[i.severity], i.id))
    available = [r for r in scenario.emergency_resources if r.availability_status == "available"]
    paths = compute_shortest_paths(graph, available, medical) if medical else {}
    used = set()
    routes = []
    summaries = []
    for incident in medical:
        supported = ambulance_count = rescue_count = 0
        rescue_required = 1 if incident.severity == "high" else 0
        # Independent fleets; each resource can serve at most one incident.
        for kind in ("ambulance", "rescue_team"):
            candidates = sorted(
                (r for r in available if r.type == kind and r.id not in used
                 and (r.id, incident.id) in paths),
                key=lambda r: (paths[r.id, incident.id].effective_travel_time_s, r.id),
            )
            for resource in candidates:
                if kind == "ambulance" and supported >= incident.injuries:
                    break
                if kind == "rescue_team" and rescue_count >= rescue_required:
                    break
                path = paths[resource.id, incident.id]
                used.add(resource.id)
                if kind == "ambulance":
                    supported += resource.response_capacity
                    ambulance_count += 1
                else:
                    rescue_count += 1
                routes.append(ResponderRoute(
                    id=resource.id, name=resource.name, type=kind,
                    destination=incident.id, incident_id=incident.id,
                    travel_time_s=path.travel_time_s, effective_travel_time_s=path.effective_travel_time_s,
                    distance_m=path.distance_m, coordinates=path.coordinates, nodes=path.nodes,
                    edge_ids=path.edge_ids, response_capacity=resource.response_capacity,
                ))
        uncovered = max(0, incident.injuries - supported)
        unfilled = rescue_required - rescue_count
        summaries.append(DispatchSummary(
            incident_id=incident.id, injuries=incident.injuries,
            supported_injuries=min(supported, incident.injuries), uncovered_injuries=uncovered,
            ambulances_dispatched=ambulance_count, rescue_teams_required=rescue_required,
            rescue_teams_dispatched=rescue_count, unfilled_rescue_requests=unfilled,
            status="covered" if not uncovered and not unfilled else "partial" if ambulance_count or rescue_count else "unserved",
        ))
    ambulances = [r for r in routes if r.type == "ambulance"]
    rescue_teams = [r for r in routes if r.type == "rescue_team"]
    metrics = EmergencyMetrics(
        **evacuation.metrics.model_dump(), active_medical_incidents=len(medical),
        ambulances_dispatched=len(ambulances), rescue_teams_dispatched=len(rescue_teams),
        average_emergency_response_time_s=round(sum(r.travel_time_s for r in routes) / len(routes), 3) if routes else 0,
        maximum_emergency_response_time_s=max((r.travel_time_s for r in routes), default=0),
        average_effective_emergency_response_time_s=round(sum(r.effective_travel_time_s for r in routes) / len(routes), 3) if routes else 0,
        uncovered_injuries=sum(s.uncovered_injuries for s in summaries),
        unfilled_rescue_requests=sum(s.unfilled_rescue_requests for s in summaries),
    )
    return IncidentPlan(**evacuation.model_dump(exclude={"metrics"}), metrics=metrics,
                        incidents=list(incidents), ambulances=ambulances,
                        rescue_teams=rescue_teams, dispatch_summary=summaries)
