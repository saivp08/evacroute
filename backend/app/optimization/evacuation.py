"""Integer min-cost flow: people from zones through shelters to a common sink."""

import networkx as nx
from ortools.graph.python import min_cost_flow

from app.models.optimization import (
    EvacuationRoute, OptimizationError, OptimizationMetrics,
    OptimizationResponse, ShelterAssignment,
)
from app.models.scenario import ScenarioResponse
from app.routing.shortest_paths import compute_shortest_paths


class InfeasiblePlan(Exception):
    def __init__(self, detail: OptimizationError):
        super().__init__(detail.message)
        self.detail = detail


def optimize_evacuation(graph: nx.MultiDiGraph, scenario: ScenarioResponse) -> OptimizationResponse:
    zones = sorted(scenario.zones, key=lambda item: item.id)
    shelters = sorted(scenario.shelters, key=lambda item: item.id)
    available = {s.id: s.available_capacity for s in shelters}
    demand = sum(z.population for z in zones)
    capacity = sum(available.values())

    def fail(code: str, message: str):
        raise InfeasiblePlan(OptimizationError(
            code=code, message=message, total_evacuees=demand,
            total_available_shelter_capacity=capacity,
        ))

    if capacity < demand:
        fail("insufficient_shelter_capacity",
             f"Evacuation demand exceeds available shelter space by {demand - capacity} people.")

    paths = compute_shortest_paths(graph, zones, shelters) if demand else {}
    solver = min_cost_flow.SimpleMinCostFlow()
    sink = len(zones) + len(shelters)
    assignment_arcs = []
    for i, zone in enumerate(zones):
        solver.set_node_supply(i, zone.population)
        for j, shelter in enumerate(shelters):
            path = paths.get((zone.id, shelter.id))
            if path is not None:
                # OR-Tools requires integer costs: round route time to milliseconds.
                arc = solver.add_arc_with_capacity_and_unit_cost(
                    i, len(zones) + j, zone.population, round(path.effective_travel_time_s * 1000)
                )
                assignment_arcs.append((arc, zone, shelter, path))
    for j, shelter in enumerate(shelters):
        solver.add_arc_with_capacity_and_unit_cost(len(zones) + j, sink, available[shelter.id], 0)
        solver.set_node_supply(len(zones) + j, 0)
    solver.set_node_supply(sink, -demand)
    status = solver.solve()
    if status == solver.INFEASIBLE:
        fail("unreachable_shelter_capacity",
             "Enough total space exists, but directed road connections cannot carry all zone demand to reachable shelters.")
    if status != solver.OPTIMAL:
        fail("optimization_failed", f"The min-cost flow solver did not produce an optimal plan (status {status.name}).")

    routes = []
    assigned = {s.id: 0 for s in shelters}
    for arc, zone, shelter, path in assignment_arcs:
        people = solver.flow(arc)
        if not people:
            continue
        assigned[shelter.id] += people
        routes.append(EvacuationRoute(
            id=f"route-{zone.id}-{shelter.id}", zone=zone.id, zone_name=zone.name,
            shelter=shelter.id, shelter_name=shelter.name, people=people,
            travel_time_s=path.travel_time_s, distance_m=path.distance_m,
            effective_travel_time_s=path.effective_travel_time_s,
            coordinates=path.coordinates, nodes=path.nodes, edge_ids=path.edge_ids,
        ))
    person_seconds = sum(r.people * r.travel_time_s for r in routes)
    effective_person_seconds = sum(r.people * r.effective_travel_time_s for r in routes)
    return OptimizationResponse(
        evacuation_routes=routes,
        shelter_assignments=[ShelterAssignment(
            shelter=s.id, shelter_name=s.name, assigned_people=assigned[s.id],
            remaining_capacity_after_assignment=available[s.id] - assigned[s.id],
        ) for s in shelters],
        metrics=OptimizationMetrics(
            total_evacuees=demand, assigned_evacuees=sum(assigned.values()),
            total_available_shelter_capacity=capacity,
            average_travel_time_s=round(person_seconds / demand, 3) if demand else 0,
            total_person_travel_time_s=round(person_seconds, 3),
            average_effective_travel_time_s=round(effective_person_seconds / demand, 3) if demand else 0,
            total_person_effective_travel_time_s=round(effective_person_seconds, 3),
        ),
    )
