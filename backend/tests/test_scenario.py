"""Offline contract tests plus an explicit real-cache integration check."""

import json
from unittest.mock import patch

import networkx as nx
import pytest
from fastapi.testclient import TestClient
from shapely.geometry import LineString

from app.data.road_network import GRAPH_PATH, load_graph, prepare_graph
from app.data.scenario import build_scenario
from app.main import create_app


@pytest.fixture
def graph():
    graph = nx.MultiDiGraph(crs="epsg:4326")
    graph.add_node(1, y=38.44, x=-122.72)
    graph.add_node(2, y=38.45, x=-122.71)
    graph.add_node(3, y=38.43, x=-122.70)
    graph.add_edge(1, 2, length=100, highway="residential", name="Demo Road",
                   geometry=LineString([(-122.72, 38.44), (-122.71, 38.45)]))
    graph.add_edge(2, 3, length=200, highway="primary", maxspeed="25 mph")
    graph.add_edge(3, 1, length=300, highway="unknown")
    return prepare_graph(graph)


def assert_scenario(data, graph):
    assert data["scenario"]["status"] == "ready"
    assert len(data["zones"]) == len(data["shelters"]) == 3
    for site in data["zones"] + data["shelters"]:
        assert int(site["graph_node"]) in graph
        assert site["simulated"] is True
    population = sum(zone["population"] for zone in data["zones"])
    assert sum(s["capacity"] for s in data["shelters"]) >= population
    assert sum(s["capacity"] - s["current_occupancy"] for s in data["shelters"]) >= population
    assert len(data["roads"]) == graph.number_of_edges()
    assert len({r["id"] for r in data["roads"]}) == len(data["roads"])
    for road in data["roads"]:
        assert road["speed_kph"] > 0
        assert road["travel_time_s"] >= 0
        assert int(road["source"]) in graph and int(road["target"]) in graph
        for lat, lon in road["coordinates"]:
            assert 38 < lat < 39 and -123 < lon < -122
    json.dumps(data, allow_nan=False)


def test_health_and_scenario(graph):
    with TestClient(create_app(lambda: graph)) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
        response = client.get("/scenario", headers={"Origin": "http://localhost:3000"})
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
        assert_scenario(response.json(), graph)
        assert "access-control-allow-origin" not in client.get(
            "/scenario", headers={"Origin": "https://untrusted.example"}
        ).headers


def test_speed_fallbacks_and_geometry(graph):
    assert graph[1][2][0]["speed_kph"] == 30
    assert graph[2][3][0]["speed_kph"] == pytest.approx(40.2336, rel=0.001)
    assert graph[3][1][0]["speed_kph"] == 30
    assert graph[1][2][0]["travel_time"] == pytest.approx(12)
    roads = build_scenario(graph).roads
    assert roads[0].coordinates == [(38.44, -122.72), (38.45, -122.71)]
    assert roads[1].coordinates == [(38.45, -122.71), (38.43, -122.70)]


def test_download_then_cache_reload(graph, tmp_path):
    path = tmp_path / "network.graphml"
    with patch("app.data.road_network.ox.graph.graph_from_point", return_value=graph) as download:
        first = load_graph(path)
        download.assert_called_once()
    with patch("app.data.road_network.ox.graph.graph_from_point", side_effect=AssertionError("Network called")):
        second = load_graph(path)
    assert set(first.nodes) == set(second.nodes)
    assert set(first.edges) == set(second.edges)
    assert build_scenario(first) == build_scenario(second)


def test_real_cached_scenario():
    with patch("app.data.road_network.ox.graph.graph_from_point", side_effect=AssertionError("Network called")):
        graph = load_graph()
        with TestClient(create_app(lambda: graph)) as client:
            response = client.get("/scenario")
            assert response.status_code == 200
            assert_scenario(response.json(), graph)
            for site in response.json()["zones"] + response.json()["shelters"]:
                node = graph.nodes[int(site["graph_node"])]
                assert abs(node["y"] - site["latitude"]) < 0.005
                assert abs(node["x"] - site["longitude"]) < 0.005
