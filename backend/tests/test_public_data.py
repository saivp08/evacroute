"""Offline public-data normalization, caching, provenance and combined-plan checks."""

import json
from unittest.mock import Mock, patch

import pytest
import requests
from fastapi.testclient import TestClient

from app.data.census import normalize_census, population_lookup, CENSUS_GEO_URL, CENSUS_POP_URL
from app.data.fema import normalize_fema, FEMA_URL
from app.data.ingest import ingest
from app.data.public_data import PROCESSED_PATH, use_processed_data
from app.data.road_network import GRAPH_PATH, load_graph
from app.data.scenario import build_scenario, ZONE_SPECS
from app.openai.client import OpenAIClient
from app.main import create_app

pytestmark = pytest.mark.public_data


@pytest.fixture
def graph():
    return load_graph()


def fema_fixture():
    return {"features": [
        {"attributes": {"shelter_id": 1, "shelter_name": "Test real location", "latitude": 38.44,
                        "longitude": -122.71, "evacuation_capacity": 0, "post_impact_capacity": 500,
                        "total_population": 10, "shelter_status_code": "CLOSED"}},
        {"attributes": {"shelter_id": 2, "shelter_name": "Unknown capacity", "latitude": 38.44,
                        "longitude": -122.71, "shelter_status_code": "OPEN"}},
        {"attributes": {"shelter_id": 3, "shelter_name": "Missing coordinates"}},
        None, {"attributes": None},
    ]}


def census_fixture():
    features = []
    for index, (_, _, lat, lon, _) in enumerate(ZONE_SPECS):
        features.append({"attributes": {"GEOID": f"0609700000{index}", "NAME": f"Census tract {index}",
                                        "POP100": [6000, 3000, 1000][index], "CENTLAT": lat, "CENTLON": lon},
                         "geometry": {"rings": [[[lon-.001, lat-.001], [lon+.001, lat-.001],
                                                  [lon+.001, lat+.001], [lon-.001, lat+.001], [lon-.001, lat-.001]]]}})
    return {"features": features + [None, {"attributes": {"GEOID": "malformed"}}]}


def test_fema_normalization_and_missing_fields(graph):
    shelters = normalize_fema(fema_fixture(), graph, "2026-09-12")
    assert len(shelters) == 2
    first, second = shelters
    assert first.capacity == 500 and first.current_occupancy == 10
    assert first.status == "CLOSED" and first.available_capacity == 0
    assert not first.simulated and first.data_source == "FEMA National Shelter System"
    assert second.capacity == 0 and not second.planning_available
    assert second.current_occupancy_is_assumed
    assert all(int(s.graph_node) in graph for s in shelters)
    payload = fema_fixture()
    payload["features"][0]["attributes"]["shelter_status_code"] = "OPEN"
    assert normalize_fema(payload, graph, "date")[0].available_capacity == 490


def test_census_normalization_and_proportional_scaling(graph):
    zones = normalize_census(census_fixture(), {}, graph, "2026-09-12")
    assert [z.population for z in zones] == [1200, 600, 200]
    assert [z.original_population for z in zones] == [6000, 3000, 1000]
    assert all(z.population_is_scaled and z.population_scale_factor == 0.2 for z in zones)
    assert all(not z.simulated and z.data_source and z.boundary and int(z.graph_node) in graph for z in zones)
    assert all(38 < z.boundary[0][0][0] < 39 for z in zones)
    lookup = population_lookup([["NAME", "P1_001N", "state", "county", "tract"],
                                ["x", "123", "06", "097", "000001"], ["bad", "-1", "06", "097", "000002"]])
    assert lookup == {"06097000001": 123}


def test_missing_or_invalid_processed_data_falls_back(graph, tmp_path, caplog):
    fallback = build_scenario(graph, use_public_data=False)
    path = tmp_path / "missing.json"
    assert use_processed_data(fallback, graph, path).scenario.data_mode == "demo_fallback"
    path.write_text('{"schema_version":1,"zones":[null]}')
    assert use_processed_data(fallback, graph, path).zones == fallback.zones
    path.write_text('[]')
    assert use_processed_data(fallback, graph, path).zones == fallback.zones
    assert "fallback" in caplog.text


def test_ingestion_mocked_and_preserves_cache_on_external_failure(graph, tmp_path):
    path = tmp_path / "scenario.json"
    def fetch(url, params):
        if url == FEMA_URL:
            return fema_fixture()
        if url == CENSUS_GEO_URL:
            return census_fixture()
        if url == CENSUS_POP_URL:
            raise requests.ConnectionError("offline")
    with patch("app.data.ingest.fetch_json", side_effect=fetch):
        first = ingest(graph, path, tmp_path / "raw")
    assert first and len(first["zones"]) == 3
    assert sum(not s["simulated"] for s in first["shelters"]) == 2
    with patch("app.data.ingest.fetch_json", side_effect=requests.ConnectionError("offline")):
        second = ingest(graph, path, tmp_path / "raw")
    assert second["zones"] == first["zones"]
    assert second["shelters"] == first["shelters"]
    assert second["metadata"]["fema"]["refresh_failed"]
    with patch("requests.get", side_effect=AssertionError("Startup must not fetch public data")):
        loaded = use_processed_data(build_scenario(graph, use_public_data=False), graph, path)
    assert loaded.scenario.data_mode == "public_cached"


def test_ingestion_without_any_sources_uses_demo(graph, tmp_path):
    with patch("app.data.ingest.fetch_json", side_effect=requests.Timeout("offline")):
        payload = ingest(graph, tmp_path / "scenario.json", tmp_path / "raw")
    assert payload and all(z["simulated"] for z in payload["zones"])
    assert all(s["simulated"] for s in payload["shelters"])


def test_committed_cached_scenario_and_full_pipeline(graph):
    assert PROCESSED_PATH.exists()
    openai = Mock(spec=OpenAIClient)
    report = "Twelve injuries are reported in Zone C."
    openai.parse.return_value = {"events": [{"type": "MEDICAL_INCIDENT", "zone": "Zone C", "injuries": 12,
                                          "severity": "high", "certainty": "confirmed", "evidence": report}]}
    with patch("requests.get", side_effect=AssertionError("No public network during startup")):
        app = create_app(lambda: graph, openai)
        with TestClient(app) as client:
            scenario = client.get("/scenario").json()
            assert scenario["scenario"]["data_mode"] == "public_cached"
            assert [z["id"] for z in scenario["zones"]] == ["zone-a", "zone-b", "zone-c"]
            assert all(not z["simulated"] and z["data_source"] and int(z["graph_node"]) in graph for z in scenario["zones"])
            assert all(s["data_source"] and int(s["graph_node"]) in graph for s in scenario["shelters"])
            assert len([s for s in scenario["shelters"] if not s["simulated"]]) == 25
            baseline = client.post("/optimize")
            assert baseline.status_code == 200
            baseline = baseline.json()
            assert baseline["metrics"]["assigned_evacuees"] == sum(z["population"] for z in scenario["zones"]) == 2000
            for zone in scenario["zones"]:
                assert sum(r["people"] for r in baseline["evacuation_routes"] if r["zone"] == zone["id"]) == zone["population"]
            for shelter in app.state.scenario.shelters:
                assigned = sum(r["people"] for r in baseline["evacuation_routes"] if r["shelter"] == shelter.id)
                assert assigned <= shelter.available_capacity
                if shelter.status == "CLOSED":
                    assert assigned == 0
            closure = client.post("/incident", json={"type": "ROAD_CLOSURE", "edge_id": "56074847:56131839:0"})
            assert closure.status_code == 200
            assert closure.json()["evacuation_routes"] != baseline["evacuation_routes"]
            assert closure.json()["metrics"]["assigned_evacuees"] == 2000
            assert client.post("/incidents/reset").json() == baseline
            parsed = client.post("/incident/parse", json={"report": report})
            assert parsed.status_code == 200
            assert len(parsed.json()["ambulances"]) == 3 and len(parsed.json()["rescue_teams"]) == 1
            assert parsed.json()["applied_events"][0]["zone"] == "zone-c"
            assert client.post("/incidents/reset").json() == baseline
            assert client.post("/incident", json={"type": "MEDICAL_INCIDENT", "zone": "zone-c", "injuries": 12}).status_code == 200
            assert client.post("/incidents/reset").json() == baseline
