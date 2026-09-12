"""Allocation invariants, actual optimality, route geometry, and API failures."""

import json

import networkx as nx
import pytest
from fastapi.testclient import TestClient
from shapely.geometry import LineString

from app.data.road_network import GRAPH_PATH, load_graph
from app.data.scenario import build_scenario
from app.main import create_app
from app.models.scenario import ScenarioInfo, ScenarioResponse, Shelter, Zone
from app.optimization.evacuation import optimize_evacuation
from app.routing.shortest_paths import compute_shortest_paths


@pytest.fixture
def small_case():
    graph = nx.MultiDiGraph(crs="epsg:4326")
    for node in range(4):
        graph.add_node(node, y=38.44 + node * 0.001, x=-122.72 + node * 0.001)
    for source, target, seconds in [(0, 2, 10), (0, 3, 11), (1, 2, 1), (1, 3, 100)]:
        graph.add_edge(source, target, key=0, travel_time=seconds, length=seconds * 10,
                       edge_id=f"{source}:{target}:0", speed_kph=36)
    # A slower parallel edge must never supply the route length or geometry.
    graph.add_edge(0, 2, key=1, travel_time=50, length=9999, edge_id="0:2:1", speed_kph=36)
    graph[0][2][0]["geometry"] = LineString([
        (-122.718, 38.442), (-122.7195, 38.4415), (-122.72, 38.44)
    ])  # Deliberately reversed.
    zones = [Zone(id=f"zone-{i}", name=f"Zone {i}", latitude=graph.nodes[i]["y"],
                  longitude=graph.nodes[i]["x"], graph_node=str(i), population=p)
             for i, p in [(0, 6), (1, 4)]]
    shelters = [Shelter(id=f"shelter-{i}", name=f"Shelter {i}",
                        latitude=graph.nodes[i]["y"], longitude=graph.nodes[i]["x"],
                        graph_node=str(i), capacity=6, current_occupancy=1) for i in [2, 3]]
    scenario = ScenarioResponse(scenario=ScenarioInfo(node_count=4, edge_count=5),
                                zones=zones, shelters=shelters, roads=[])
    return graph, scenario


def assert_plan(plan, scenario, graph):
    assert plan.metrics.assigned_evacuees == plan.metrics.total_evacuees == sum(z.population for z in scenario.zones)
    assert sum(r.people for r in plan.evacuation_routes) == plan.metrics.total_evacuees
    for zone in scenario.zones:
        assert sum(r.people for r in plan.evacuation_routes if r.zone == zone.id) == zone.population
    for shelter in scenario.shelters:
        count = sum(r.people for r in plan.evacuation_routes if r.shelter == shelter.id)
        assert count <= shelter.capacity - shelter.current_occupancy
        assignment = next(s for s in plan.shelter_assignments if s.shelter == shelter.id)
        assert assignment.assigned_people == count
        assert assignment.remaining_capacity_after_assignment == shelter.capacity - shelter.current_occupancy - count
    for route in plan.evacuation_routes:
        zone = next(z for z in scenario.zones if z.id == route.zone)
        shelter = next(s for s in scenario.shelters if s.id == route.shelter)
        assert route.nodes[0] == zone.graph_node and route.nodes[-1] == shelter.graph_node
        assert route.travel_time_s > 0 and route.distance_m > 0
        assert len(route.coordinates) >= 2
        for point, node_id in [(route.coordinates[0], zone.graph_node), (route.coordinates[-1], shelter.graph_node)]:
            node = graph.nodes[int(node_id)]
            assert point == (round(node["y"], 6), round(node["x"], 6))
        edges = [graph[int(u)][int(v)][int(k)] for u, v, k in (id_.split(":") for id_ in route.edge_ids)]
        assert route.travel_time_s == pytest.approx(sum(e["travel_time"] for e in edges), abs=0.001)
        assert route.distance_m == pytest.approx(sum(e["length"] for e in edges), abs=0.001)
    expected = sum(r.people * r.travel_time_s for r in plan.evacuation_routes)
    assert plan.metrics.total_person_travel_time_s == pytest.approx(expected, abs=0.001)
    assert plan.metrics.average_travel_time_s == pytest.approx(expected / plan.metrics.total_evacuees, abs=0.001)
    json.dumps(plan.model_dump(mode="json"), allow_nan=False)


def test_global_optimum_splits_zone_and_is_deterministic(small_case):
    graph, scenario = small_case
    plan = optimize_evacuation(graph, scenario)
    assert_plan(plan, scenario, graph)
    # Global optimum reserves the cheapest shelter for Zone 1; a greedy
    # Zone-0-first allocation is more expensive. Exhaustive integer oracle.
    oracle = min(a * 10 + (6-a) * 11 + b + (4-b) * 100
                 for a in range(7) for b in range(5)
                 if a + b <= 5 and (6-a) + (4-b) <= 5)
    assert plan.metrics.total_person_travel_time_s == oracle == 69
    assert [(r.zone, r.shelter, r.people) for r in plan.evacuation_routes] == [
        ("zone-0", "shelter-2", 1), ("zone-0", "shelter-3", 5), ("zone-1", "shelter-2", 4)]
    assert plan == optimize_evacuation(graph, scenario)
    assert scenario.shelters[0].current_occupancy == 1


def test_parallel_edge_and_reversed_geometry(small_case):
    graph, scenario = small_case
    path = compute_shortest_paths(graph, scenario.zones, scenario.shelters)["zone-0", "shelter-2"]
    assert path.edge_ids == ["0:2:0"]
    assert path.travel_time_s == 10 and path.distance_m == 100
    assert path.coordinates == [(38.44, -122.72), (38.4415, -122.7195), (38.442, -122.718)]


def test_multi_edge_path_uses_travel_time_not_distance(small_case):
    graph, scenario = small_case
    graph.add_edge(2, 3, travel_time=0.5, length=200, edge_id="2:3:0", speed_kph=36)
    path = compute_shortest_paths(graph, scenario.zones, scenario.shelters)["zone-0", "shelter-3"]
    assert path.nodes == ["0", "2", "3"]
    assert path.travel_time_s == 10.5 and path.distance_m == 300
    assert path.coordinates == [(38.44, -122.72), (38.4415, -122.7195), (38.442, -122.718), (38.443, -122.717)]


@pytest.mark.parametrize("failure", ["capacity", "unreachable"])
def test_api_structured_infeasibility(small_case, failure):
    graph, scenario = small_case
    if failure == "capacity":
        scenario.shelters[0].capacity = 1
        code = "insufficient_shelter_capacity"
    else:
        graph.remove_edges_from(list(graph.out_edges(1, keys=True)))
        code = "unreachable_shelter_capacity"
    app = create_app(lambda: graph)
    with TestClient(app) as client:
        app.state.scenario = scenario
        response = client.post("/optimize")
        assert response.status_code == 409
        assert response.json()["detail"]["code"] == code
        assert response.json()["detail"]["total_evacuees"] == 10


def test_zero_demand_and_colocated_sites(small_case):
    graph, scenario = small_case
    for zone in scenario.zones:
        zone.population = 0
    plan = optimize_evacuation(graph, scenario)
    assert plan.evacuation_routes == []
    assert plan.metrics.average_travel_time_s == 0
    scenario.zones[0].population = 1
    scenario.zones[0].graph_node = scenario.shelters[0].graph_node
    route = optimize_evacuation(graph, scenario).evacuation_routes[0]
    assert route.travel_time_s == route.distance_m == 0
    assert route.coordinates[0] == route.coordinates[-1]


def test_real_optimize_api():
    graph = load_graph()
    app = create_app(lambda: graph)
    with TestClient(app) as client:
        before = client.get("/scenario").json()
        response = client.post("/optimize", headers={"Origin": "http://localhost:3000"})
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
        from app.models.optimization import OptimizationResponse
        assert_plan(OptimizationResponse.model_validate(response.json()), app.state.scenario, graph)
        assert response.json() == client.post("/optimize").json()
        assert before == client.get("/scenario").json()
        assert client.get("/health").json() == {"status": "ok"}
        preflight = client.options("/optimize", headers={
            "Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        })
        assert preflight.status_code == 200
