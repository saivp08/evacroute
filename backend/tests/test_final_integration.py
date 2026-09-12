"""Offline final frontend contract and canonical demo regression tests."""

from unittest.mock import Mock, patch
import json

import pytest
from fastapi.testclient import TestClient

from app.data import road_network
from app.data.public_data import PROCESSED_PATH, use_processed_data
from app.data.scenario import build_scenario
from app.grok.client import GrokClient
from app.main import create_app
from smoke_test import DEMO, run

pytestmark = pytest.mark.public_data


@pytest.fixture(scope="module")
def graph():
    return road_network.load_graph()


def test_canonical_parsed_demo(graph):
    grok = Mock(spec=GrokClient)
    grok.parse.side_effect = [
        {"events": DEMO["expected_events"]},
        {"events": [{"type": "ROAD_REOPEN", "road_name": "College Avenue", "certainty": "confirmed",
                     "evidence": DEMO["reopen_report"]}]}]
    with TestClient(create_app(lambda: graph, grok)) as client:
        result = run(client, live_grok=True)
    assert grok.parse.call_count == 2
    assert set(result["ambulance_ids"]) == {"ambulance-1", "ambulance-2", "ambulance-3"}
    assert result["rescue_team_ids"] == ["rescue-team-1"]


def test_canonical_structured_demo_and_isolated_state(graph):
    with TestClient(create_app(lambda: graph)) as client:
        run(client)
        schema = client.get("/openapi.json").json()
        for endpoint in ("/optimize", "/incident", "/incident/parse", "/incidents/reset"):
            assert schema["paths"][endpoint]["post"]["responses"]["422"]["content"]["application/json"]["schema"]["$ref"].endswith("ErrorResponse")
    with TestClient(create_app(lambda: graph)) as fresh:
        assert fresh.get("/incidents").json() == {"incidents": []}
        assert fresh.post("/optimize").json()["ambulances"] == []


def test_invalid_metadata_falls_back(graph, tmp_path):
    payload = json.loads(PROCESSED_PATH.read_text(encoding="utf-8"))
    payload["metadata"] = ["invalid metadata"]
    path = tmp_path / "invalid.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    loaded = use_processed_data(build_scenario(graph, use_public_data=False), graph, path)
    assert loaded.scenario.data_mode == "demo_fallback"


@pytest.mark.parametrize("origin", ["http://localhost:3000", "http://127.0.0.1:3000"])
def test_cors_and_structured_errors(graph, origin, monkeypatch):
    monkeypatch.delenv("GROK_API_KEY", raising=False)
    with TestClient(create_app(lambda: graph)) as client:
        response = client.options("/incident/parse", headers={"Origin": origin,
            "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin
        for path, body, status, code in [
            ("/incident", {"type": "ROAD_CLOSURE", "road_name": "No Such Road"}, 404, "road_target_not_found"),
            ("/incident", {"type": "MEDICAL_INCIDENT", "zone": "unknown", "injuries": 1}, 404, "incident_location_not_found"),
            ("/incident", {"type": "MEDICAL_INCIDENT", "zone": "zone-c", "injuries": -1}, 422, "validation_error"),
            ("/incident/parse", {"report": DEMO["report"]}, 503, "grok_not_configured"),
            ("/incident", {"type": "ROAD_CLOSURE", "road_name": "Eardley Avenue"}, 409, "unreachable_shelter_capacity"),
        ]:
            response = client.post(path, json=body, headers={"Origin": origin})
            assert response.status_code == status
            assert response.json()["error"]["code"] == code
            assert "detail" in response.json()
            assert response.headers["access-control-allow-origin"] == origin
            assert client.get("/incidents").json() == {"incidents": []}
        with patch("app.main.plan_transportation", side_effect=RuntimeError("secret must not escape")):
            failed = client.post("/optimize", headers={"Origin": origin})
        assert failed.status_code == 500 and failed.json()["error"]["code"] == "internal_error"
        assert "secret" not in failed.text and failed.headers["access-control-allow-origin"] == origin


def test_missing_and_corrupt_road_cache_restore_offline(tmp_path, monkeypatch):
    path = tmp_path / "roads.graphml"
    monkeypatch.setattr(road_network, "GRAPH_PATH", path)
    with patch("osmnx.graph.graph_from_point", side_effect=AssertionError("No network")):
        first = road_network.load_graph(path)
        assert (len(first), first.number_of_edges()) == (1662, 4358)
        path.write_text("corrupted")
        restored = road_network.load_graph(path)
        assert set(restored.edges(keys=True)) == set(first.edges(keys=True))
    broken_bundle = tmp_path / "broken.gz"
    broken_bundle.write_bytes(b"invalid gzip")
    monkeypatch.setattr(road_network, "BUNDLED_GRAPH_PATH", broken_bundle)
    path.write_text("corrupted")
    with pytest.raises(RuntimeError, match="restore datasets/processed"):
        road_network.load_graph(path)
