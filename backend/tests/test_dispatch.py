"""Fleet constraints, severity priority, dynamic routing, and real dispatch API."""

from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from app.data.incidents import IncidentState, derive_graph
from app.data.road_network import GRAPH_PATH, load_graph
from app.main import create_app
from app.models.incidents import ActiveIncident, IncidentRequest
from app.models.scenario import EmergencyResource
from app.optimization.dispatch import plan_transportation
from tests.test_optimization import small_case, assert_plan

MEDICAL = {"type": "MEDICAL_INCIDENT", "zone": "zone-c", "injuries": 12, "severity": "high"}
CLOSURE_EDGE = "300788174:56152123:0"


@pytest.fixture
def fleet_case(small_case):
    graph, scenario = small_case
    for i in range(4):
        node = i % 2
        scenario.emergency_resources.append(EmergencyResource(
            id=f"ambulance-{i+1}", name=f"Ambulance {i+1}", type="ambulance",
            latitude=graph.nodes[node]["y"], longitude=graph.nodes[node]["x"],
            graph_node=str(node), response_capacity=4,
        ))
    scenario.emergency_resources.append(EmergencyResource(
        id="rescue-team-1", name="Rescue 1", type="rescue_team", latitude=38.44,
        longitude=-122.72, graph_node="0", response_capacity=1,
    ))
    return graph, scenario


def medical(id_="medical-test", node="2", severity="high", injuries=12):
    return ActiveIncident(id=id_, type="MEDICAL_INCIDENT", severity=severity,
                          graph_node=node, injuries=injuries, affected_edge_ids=[])


@pytest.mark.parametrize("injuries,count,uncovered", [(1, 1, 0), (4, 1, 0), (5, 2, 0), (12, 3, 0), (17, 4, 1)])
def test_capacity_and_shortfall(fleet_case, injuries, count, uncovered):
    graph, scenario = fleet_case
    plan = plan_transportation(graph, scenario, [medical(injuries=injuries)])
    assert len(plan.ambulances) == count
    assert len(plan.rescue_teams) == 1
    assert plan.metrics.uncovered_injuries == uncovered
    assert plan.dispatch_summary[0].supported_injuries == min(16, injuries)
    assert plan.dispatch_summary[0].status == ("covered" if uncovered == 0 else "partial")
    assert_plan(plan, scenario, graph)


def test_priority_unavailable_unique_assignment_and_no_mutation(fleet_case):
    graph, scenario = fleet_case
    scenario.emergency_resources[0].availability_status = "unavailable"
    before = deepcopy(scenario.model_dump())
    low = medical(id_="a-low", node="3", severity="low", injuries=12)
    high = medical(id_="z-high", node="2", severity="high", injuries=12)
    plan = plan_transportation(graph, scenario, [low, high])
    assert len(plan.ambulances) == 3
    assert {r.incident_id for r in plan.ambulances} == {high.id}
    assert all(r.id != "ambulance-1" for r in plan.ambulances)
    routes = plan.ambulances + plan.rescue_teams
    assert len({r.id for r in routes}) == len(routes)
    assert plan.dispatch_summary[1].uncovered_injuries == 12
    assert plan.dispatch_summary[1].status == "unserved"
    assert plan == plan_transportation(graph, scenario, [low, high])
    assert scenario.model_dump() == before


def test_effective_cost_changes_dispatch_and_blocked_resources_are_unreachable(fleet_case):
    graph, scenario = fleet_case
    incident = medical(injuries=4, severity="low")
    baseline = plan_transportation(graph, scenario, [incident])
    assert baseline.ambulances[0].id == "ambulance-2"  # 1 second vs 10 seconds.
    state = IncidentState()
    for kind in ["HAZARD_UPDATE", "ROAD_DAMAGE"]:
        _, state.active = state.propose(graph, IncidentRequest(type=kind, edge_id="1:2:0", severity="high"))
    graph_with_penalties = derive_graph(graph, state.active)
    plan = plan_transportation(graph_with_penalties, scenario, state.active + [incident])
    assert plan.ambulances[0].id == "ambulance-1"  # 10 seconds vs effective 20.
    _, state.active = state.propose(graph, IncidentRequest(type="ROAD_CLOSURE", edge_id="1:2:0"))
    plan = plan_transportation(derive_graph(graph, state.active), scenario, state.active + [incident])
    assert plan.ambulances[0].id == "ambulance-1"
    assert all("1:2:0" not in r.edge_ids for r in plan.ambulances)
    plan = plan_transportation(derive_graph(graph, state.active), scenario, state.active + [medical(node="0", injuries=4)])
    # Co-located resource is valid zero-distance response; none can traverse closures.
    assert plan.ambulances[0].travel_time_s == 0
    assert all("1:2:0" not in r.edge_ids for r in plan.ambulances)


def test_unreachable_medical_target_reports_shortfall_without_losing_evacuation(fleet_case):
    graph, scenario = fleet_case
    graph.add_node(99, y=38.441, x=-122.721)
    plan = plan_transportation(graph, scenario, [medical(node="99")])
    assert plan.ambulances == plan.rescue_teams == []
    assert plan.dispatch_summary[0].status == "unserved"
    assert plan.metrics.uncovered_injuries == 12 and plan.metrics.unfilled_rescue_requests == 1
    assert plan.metrics.average_emergency_response_time_s == 0
    assert_plan(plan, scenario, graph)


@pytest.mark.parametrize("body,status", [
    ({"type": "MEDICAL_INCIDENT", "zone": "missing", "injuries": 4}, 404),
    ({"type": "MEDICAL_INCIDENT", "latitude": 0, "longitude": 0, "injuries": 4}, 404),
    ({"type": "MEDICAL_INCIDENT", "zone": "zone-c"}, 422),
    ({"type": "MEDICAL_INCIDENT", "zone": "zone-c", "injuries": 0}, 422),
    ({"type": "MEDICAL_INCIDENT", "zone": "zone-c", "injuries": 1.5}, 422),
    ({"type": "MEDICAL_INCIDENT", "edge_id": "0:2:0", "injuries": 4}, 422),
])
def test_invalid_medical_reports(fleet_case, body, status):
    graph, _ = fleet_case
    with TestClient(create_app(lambda: graph)) as client:
        assert client.post("/incident", json=body).status_code == status
        assert client.get("/incidents").json() == {"incidents": []}


def test_coordinate_medical_upsert_and_road_updates_preserve_medical(fleet_case):
    graph, scenario = fleet_case
    state = IncidentState()
    request = IncidentRequest(type="MEDICAL_INCIDENT", latitude=38.442, longitude=-122.718, injuries=4)
    first, state.active = state.propose(graph, request, scenario)
    assert first.graph_node == "2"
    repeated, active = state.propose(graph, request, scenario)
    assert repeated == first and active == state.active
    changed, state.active = state.propose(graph, request.model_copy(update={"injuries": 12}), scenario)
    assert changed.id == first.id and len(state.active) == 1
    assert state.active[0].injuries == 12
    _, state.active = state.propose(graph, IncidentRequest(type="ROAD_CLOSURE", edge_id="0:2:0"), scenario)
    assert any(i.id == first.id for i in state.active)


def test_real_combined_dispatch_closure_reset():
    graph = load_graph()
    app = create_app(lambda: graph)
    with TestClient(app) as client:
        scenario_before = client.get("/scenario").json()
        resources = scenario_before["emergency_resources"]
        assert len(resources) == 6
        assert sum(r["type"] == "ambulance" for r in resources) == 4
        assert sum(r["type"] == "rescue_team" for r in resources) == 2
        assert all(r["simulated"] and int(r["graph_node"]) in graph for r in resources)
        baseline = client.post("/optimize").json()
        assert baseline["ambulances"] == baseline["rescue_teams"] == []
        response = client.post("/incident", json=MEDICAL)
        assert response.status_code == 200
        data = response.json()
        assert len(data["ambulances"]) == 3 and len(data["rescue_teams"]) == 1
        assert data["evacuation_routes"] == baseline["evacuation_routes"]
        assert data == client.post("/incident", json=MEDICAL).json()
        assert len(client.get("/incidents").json()["incidents"]) == 1
        for route in data["ambulances"] + data["rescue_teams"]:
            resource = next(r for r in resources if r["id"] == route["id"])
            assert route["nodes"][0] == resource["graph_node"]
            assert route["nodes"][-1] == data["incident"]["graph_node"]
            for coordinates, node_id in [(route["coordinates"][0], route["nodes"][0]), (route["coordinates"][-1], route["nodes"][-1])]:
                node = graph.nodes[int(node_id)]
                assert coordinates == [round(node["y"], 6), round(node["x"], 6)]
            assert route["travel_time_s"] > 0 and route["distance_m"] > 0
        closure = client.post("/incident", json={"type": "ROAD_CLOSURE", "edge_id": CLOSURE_EDGE})
        assert closure.status_code == 200
        after = closure.json()
        assert after["metrics"]["active_medical_incidents"] == 1
        before_routes = {r["id"]: r for r in data["ambulances"]}
        assert any(r["edge_ids"] != before_routes[r["id"]]["edge_ids"] for r in after["ambulances"])
        assert all(CLOSURE_EDGE not in r["edge_ids"] for r in after["ambulances"] + after["rescue_teams"] + after["evacuation_routes"])
        from app.models.incidents import IncidentPlan
        assert_plan(IncidentPlan.model_validate(after), app.state.scenario, graph)
        assert client.get("/scenario").json() == scenario_before
        assert client.post("/incidents/reset").json() == baseline
        assert client.post("/optimize").json() == baseline
