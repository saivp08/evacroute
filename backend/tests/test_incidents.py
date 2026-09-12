"""Incident lifecycle, cost composition, targeting, and real demo regression."""

from copy import deepcopy

import networkx as nx
import pytest
from fastapi.testclient import TestClient

from app.data.incidents import IncidentState, derive_graph, resolve_target
from app.data.road_network import GRAPH_PATH, load_graph
from app.main import create_app
from app.models.incidents import IncidentRequest
from app.models.optimization import OptimizationResponse
from app.routing.shortest_paths import compute_shortest_paths
from tests.test_optimization import assert_plan, small_case

DEMO_EDGE = "56073223:56093740:0"


def test_penalties_compose_without_mutating_base(small_case):
    graph, scenario = small_case
    before = deepcopy(dict(graph[0][2][0]))
    state = IncidentState()
    for kind in ["HAZARD_UPDATE", "ROAD_DAMAGE", "DEBRIS"]:
        _, state.active = state.propose(graph, IncidentRequest(type=kind, edge_id="0:2:0", severity="low"))
    derived = derive_graph(graph, state.active)
    assert derived[0][2][0]["effective_travel_time"] == 10 * 2 * 1.5 * 2
    assert derived[0][2][0]["blocked"] is False
    assert dict(graph[0][2][0]) == before
    # Cheapest parallel edge switches from key 0 (effective 60s) to key 1 (50s).
    path = compute_shortest_paths(derived, scenario.zones, scenario.shelters)["zone-0", "shelter-2"]
    assert path.edge_ids == ["0:2:1"]
    assert path.effective_travel_time_s == 50
    # Same hazard repeated does not stack; a lower update replaces a higher one.
    _, first = state.propose(graph, IncidentRequest(type="HAZARD_UPDATE", edge_id="0:2:0", severity="high"))
    state.active = first
    _, second = state.propose(graph, IncidentRequest(type="HAZARD_UPDATE", edge_id="0:2:0", severity="high"))
    assert first == second


@pytest.mark.parametrize("kind,severity,multiplier,blocked", [
    ("HAZARD_UPDATE", "low", 2, False), ("HAZARD_UPDATE", "medium", 3, False),
    ("HAZARD_UPDATE", "high", 5, False), ("ROAD_DAMAGE", "high", 4, False),
    ("DEBRIS", "medium", 5, False), ("DEBRIS", "high", 1, True),
])
def test_each_incident_effect(small_case, kind, severity, multiplier, blocked):
    graph, _ = small_case
    _, active = IncidentState().propose(graph, IncidentRequest(type=kind, edge_id="1:2:0", severity=severity))
    edge = derive_graph(graph, active)[1][2][0]
    assert edge["effective_travel_time"] == multiplier
    assert edge["blocked"] is blocked


def test_targets_and_partial_reopen(small_case):
    graph, _ = small_case
    graph[0][2][0]["name"] = "Shared Road"
    graph[1][2][0]["name"] = ["Shared Road", "Other Road"]
    assert resolve_target(graph, IncidentRequest(type="ROAD_CLOSURE", road_name="shared road")) == ["0:2:0", "1:2:0"]
    assert resolve_target(graph, IncidentRequest(type="ROAD_CLOSURE", latitude=38.44, longitude=-122.72)) == ["0:2:0"]
    state = IncidentState()
    _, state.active = state.propose(graph, IncidentRequest(type="ROAD_CLOSURE", edge_ids=["0:2:0", "1:2:0"]))
    _, state.active = state.propose(graph, IncidentRequest(type="DEBRIS", edge_id="0:2:0", severity="high"))
    _, state.active = state.propose(graph, IncidentRequest(type="HAZARD_UPDATE", edge_id="0:2:0"))
    _, state.active = state.propose(graph, IncidentRequest(type="ROAD_REOPEN", edge_id="0:2:0"))
    derived = derive_graph(graph, state.active)
    assert derived[1][2][0]["blocked"] is True
    assert derived[0][2][0]["blocked"] is False
    assert derived[0][2][0]["hazard_risk"] == 1
    assert all(i.type != "ROAD_REOPEN" for i in state.active)


@pytest.mark.parametrize("target,status", [
    ({"edge_id": "bad-id"}, 404), ({"edge_ids": ["0:2:0", "missing"]}, 404),
    ({"road_name": "Missing Road"}, 404), ({"latitude": 0, "longitude": 0}, 404),
    ({}, 422), ({"latitude": 38.44}, 422), ({"edge_ids": []}, 422),
    ({"edge_id": "0:2:0", "road_name": "ambiguous"}, 422),
])
def test_invalid_targets_are_client_errors(small_case, target, status):
    graph, _ = small_case
    with TestClient(create_app(lambda: graph)) as client:
        response = client.post("/incident", json={"type": "ROAD_CLOSURE", **target})
        assert response.status_code == status
        assert client.get("/incidents").json() == {"incidents": []}


def test_api_hazard_replan_and_infeasible_rollback(small_case):
    graph, scenario = small_case
    app = create_app(lambda: graph)
    with TestClient(app) as client:
        app.state.scenario = scenario
        baseline = client.post("/optimize").json()
        response = client.post("/incident", json={"type": "HAZARD_UPDATE", "edge_id": "1:2:0"})
        assert response.status_code == 200
        assert response.json()["metrics"]["total_person_effective_travel_time_s"] > baseline["metrics"]["total_person_effective_travel_time_s"]
        assert client.post("/optimize").json()["metrics"] == response.json()["metrics"]
        active = client.get("/incidents").json()
        result = client.post("/incident", json={"type": "ROAD_CLOSURE", "edge_ids": ["1:2:0", "1:3:0"]})
        assert result.status_code == 409
        assert result.json()["detail"]["incident_applied"] is False
        assert client.get("/incidents").json() == active
        assert client.post("/incidents/reset").status_code == 200
        assert client.post("/optimize").json() == baseline


@pytest.mark.skipif(not GRAPH_PATH.exists(), reason="Download Santa Rosa cache once")
def test_real_demo_closure_reopen_reset():
    graph = load_graph()
    cache_before = GRAPH_PATH.read_bytes()
    base_before = deepcopy(nx.node_link_data(graph))
    app = create_app(lambda: graph)
    with TestClient(app) as client:
        baseline = client.post("/optimize").json()
        request = {"type": "ROAD_CLOSURE", "edge_id": DEMO_EDGE}
        result = client.post("/incident", json=request)
        assert result.status_code == 200
        data = result.json()
        assert data["affected_edge_ids"] == [DEMO_EDGE]
        assert data["incidents"] == client.get("/incidents").json()["incidents"]
        assert data == client.post("/incident", json=request).json()
        updated = client.post("/optimize").json()
        assert updated["evacuation_routes"] != baseline["evacuation_routes"]
        assert all(DEMO_EDGE not in r["edge_ids"] for r in updated["evacuation_routes"])
        assert_plan(OptimizationResponse.model_validate(updated), app.state.scenario, graph)
        reopened = client.post("/incident", json={"type": "ROAD_REOPEN", "edge_id": DEMO_EDGE})
        assert reopened.status_code == 200
        assert reopened.json()["incidents"] == []
        assert client.post("/optimize").json() == baseline
        assert client.post("/incident", json=request).status_code == 200
        reset = client.post("/incidents/reset")
        assert reset.status_code == 200 and reset.json()["incidents"] == []
        assert client.get("/incidents").json() == {"incidents": []}
        assert client.post("/optimize").json() == baseline
    assert nx.node_link_data(graph) == base_before
    assert GRAPH_PATH.read_bytes() == cache_before
