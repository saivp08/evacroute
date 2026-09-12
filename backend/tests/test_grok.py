"""Offline provider contract and parse-to-plan tests. Never contacts live Grok."""

import json
from pathlib import Path
from unittest.mock import Mock

import httpx
import pytest
from fastapi.testclient import TestClient

from app.data.incidents import derive_graph
from app.data.road_network import GRAPH_PATH, load_graph
from app.grok.client import GrokClient, GrokError
from app.grok.schemas import ParsedReport
from app.main import create_app
from app.models.incidents import IncidentPlan
from tests.test_optimization import small_case, assert_plan

REPORTS = json.loads((Path(__file__).parents[1] / "app/grok/demo_reports.json").read_text(encoding="utf-8"))


def fake_parser(payload):
    parser = Mock(spec=GrokClient)
    parser.parse.return_value = payload
    return parser


def provider(monkeypatch, handler):
    # Only test-owned dummy credentials. MockTransport never opens a socket.
    monkeypatch.setenv("GROK_API_KEY", "unit-test-placeholder")
    monkeypatch.setenv("GROK_BASE_URL", "https://api.x.ai/v1")
    monkeypatch.setenv("GROK_MODEL", "grok-4.6")
    monkeypatch.setenv("GROK_TIMEOUT_SECONDS", "30")
    real_client = httpx.Client
    monkeypatch.setattr("app.grok.client.httpx.Client", lambda **kwargs: real_client(
        transport=httpx.MockTransport(handler), **kwargs))


def envelope(content, finish_reason="stop"):
    return {"choices": [{"finish_reason": finish_reason, "message": {"content": content}}]}


def test_real_client_request_schema_and_typed_validation(monkeypatch):
    def handler(request):
        data = json.loads(request.content)
        assert request.url == "https://api.x.ai/v1/chat/completions"
        assert data["model"] == "grok-4.6"
        assert data["response_format"]["json_schema"]["strict"] is True
        schema = data["response_format"]["json_schema"]["schema"]
        assert schema["additionalProperties"] is False
        assert "edge_id" not in schema["$defs"]["ParsedEvent"]["properties"]
        assert "Do not recommend actions" in data["messages"][0]["content"]
        return httpx.Response(200, json=envelope(json.dumps(REPORTS[0]["expected"])))
    provider(monkeypatch, handler)
    result = GrokClient().parse(REPORTS[0]["report"], {})
    assert isinstance(result, ParsedReport)
    assert result.events[1].injuries == 12


@pytest.mark.parametrize("content", ["not json", "```json\n{}\n```", '{"events":[{"type":"EVACUATE"}]}',
    '{"events":[{"type":"ROAD_CLOSURE","certainty":"confirmed","evidence":"x","edge_id":"1:2:0"}]}',
    '{"events":[{"type":"MEDICAL_INCIDENT","certainty":"confirmed","evidence":"x","zone":"Zone C","injuries":"12"}]}',
    '{"events":[{"type":"ROAD_CLOSURE","certainty":"confirmed","evidence":"x"}]}', "null"])
def test_invalid_provider_json(monkeypatch, content):
    provider(monkeypatch, lambda request: httpx.Response(200, json=envelope(content)))
    with pytest.raises(GrokError) as error:
        GrokClient().parse("x", {})
    assert error.value.code == "grok_invalid_response"


@pytest.mark.parametrize("payload", [{}, {"choices": []}, envelope(None), envelope('{"events":[]}', "length")])
def test_invalid_provider_envelope(monkeypatch, payload):
    provider(monkeypatch, lambda request: httpx.Response(200, json=payload))
    with pytest.raises(GrokError, match="malformed"):
        GrokClient().parse("x", {})


@pytest.mark.parametrize("http_status,status", [(401, 502), (429, 503), (500, 502)])
def test_http_failures_do_not_echo_provider_body(monkeypatch, http_status, status):
    provider(monkeypatch, lambda request: httpx.Response(http_status, text="sensitive-provider-body"))
    with pytest.raises(GrokError) as error:
        GrokClient().parse("x", {})
    assert error.value.status == status and "sensitive-provider-body" not in error.value.message


@pytest.mark.parametrize("exception,status", [(httpx.ReadTimeout, 504), (httpx.ConnectError, 503)])
def test_timeout_network_failure(monkeypatch, exception, status):
    def handler(request):
        raise exception("test transport failure", request=request)
    provider(monkeypatch, handler)
    with pytest.raises(GrokError) as error:
        GrokClient().parse("x", {})
    assert error.value.status == status


def test_missing_key_and_existing_endpoints(monkeypatch, small_case):
    monkeypatch.delenv("GROK_API_KEY", raising=False)
    graph, scenario = small_case
    app = create_app(lambda: graph)
    with TestClient(app) as client:
        app.state.scenario = scenario
        response = client.post("/incident/parse", json={"report": "Something happened"})
        assert response.status_code == 503
        assert response.json()["detail"]["code"] == "grok_not_configured"
        assert client.get("/health").json() == {"status": "ok"}
        assert client.get("/scenario").status_code == 200
        assert client.post("/optimize").status_code == 200
        assert client.get("/incidents").json() == {"incidents": []}


def test_parser_failure_endpoint(small_case):
    graph, scenario = small_case
    parser = fake_parser(None)
    parser.parse.side_effect = GrokError("grok_timeout", "Timed out", 504)
    app = create_app(lambda: graph, parser)
    with TestClient(app) as client:
        app.state.scenario = scenario
        result = client.post("/incident/parse", json={"report": "test"})
        assert result.status_code == 504
        assert result.json()["detail"]["incidents_applied"] is False
        assert client.post("/incidents/reset").status_code == 200


def test_uncertainty_and_unmentioned_evidence(small_case):
    graph, scenario = small_case
    report = "Road near Zone A might be partially blocked."
    parser = fake_parser({"events": [{"type": "ROAD_CLOSURE", "certainty": "uncertain", "evidence": report}]})
    app = create_app(lambda: graph, parser)
    with TestClient(app) as client:
        app.state.scenario = scenario
        baseline = client.post("/optimize").json()
        response = client.post("/incident/parse", json={"report": report})
        assert response.status_code == 200
        assert response.json()["applied_events"] == []
        assert response.json()["notes"]
        assert client.post("/optimize").json() == baseline
        parser.parse.return_value["events"][0]["evidence"] = "Not present in report"
        assert client.post("/incident/parse", json={"report": report}).status_code == 502
        assert client.post("/optimize").json() == baseline


def test_all_events_validate_before_application_and_batch_rollback(small_case):
    graph, scenario = small_case
    graph[0][2][0]["name"] = "Demo Road"
    parser = fake_parser({"events": [
        {"type": "ROAD_CLOSURE", "road_name": "Demo Road", "certainty": "confirmed", "evidence": "closed"},
        {"type": "MEDICAL_INCIDENT", "zone": "unknown", "injuries": 4, "certainty": "confirmed", "evidence": "injuries"},
    ]})
    app = create_app(lambda: graph, parser)
    with TestClient(app) as client:
        scenario.roads = app.state.scenario.roads
        app.state.scenario = scenario
        baseline = client.post("/optimize").json()
        result = client.post("/incident/parse", json={"report": "closed and injuries"})
        assert result.status_code == 422
        assert result.json()["detail"]["code"] == "unresolved_report_location"
        assert client.post("/optimize").json() == baseline


def test_batch_late_resolution_and_infeasibility_are_atomic(small_case):
    graph, scenario = small_case
    graph[0][2][0]["name"] = "Demo Road"
    graph[1][2][0]["name"] = graph[1][3][0]["name"] = "Exit Road"
    parser = fake_parser({"events": [
        {"type": "HAZARD_UPDATE", "road_name": "Demo Road", "certainty": "confirmed", "evidence": "hazard"},
        {"type": "MEDICAL_INCIDENT", "latitude": 0, "longitude": 0, "injuries": 4, "certainty": "confirmed", "evidence": "injuries"},
    ]})
    app = create_app(lambda: graph, parser)
    with TestClient(app) as client:
        scenario.roads = app.state.scenario.roads
        app.state.scenario = scenario
        baseline = client.post("/optimize").json()
        assert client.post("/incident/parse", json={"report": "hazard injuries"}).status_code == 422
        assert client.post("/optimize").json() == baseline
        parser.parse.return_value["events"][1] = {"type": "ROAD_CLOSURE", "road_name": "Exit Road", "certainty": "confirmed", "evidence": "closed"}
        result = client.post("/incident/parse", json={"report": "hazard closed"})
        assert result.status_code == 409 and result.json()["detail"]["incidents_applied"] is False
        assert client.get("/incidents").json() == {"incidents": []}
        assert client.post("/optimize").json() == baseline
        parser.parse.return_value["events"][1]["type"] = "UNSUPPORTED"
        assert client.post("/incident/parse", json={"report": "closed and injuries"}).status_code == 502
        assert client.post("/optimize").json() == baseline


@pytest.mark.skipif(not GRAPH_PATH.exists(), reason="Download Santa Rosa cache once")
def test_real_graph_mocked_grok_reports_replan_and_reset():
    graph = load_graph()
    parser = fake_parser(REPORTS[0]["expected"])
    app = create_app(lambda: graph, parser)
    with TestClient(app) as client:
        baseline = client.post("/optimize").json()
        data = client.post("/incident/parse", json={"report": REPORTS[0]["report"]})
        assert data.status_code == 200
        plan = data.json()
        assert len(plan["ambulances"]) == 3 and len(plan["rescue_teams"]) == 1
        assert plan["applied_events"][1]["zone"] == "zone-c"
        blocked = set(plan["incidents"][0]["affected_edge_ids"])
        assert blocked
        assert all(not blocked.intersection(r["edge_ids"]) for r in plan["evacuation_routes"] + plan["ambulances"] + plan["rescue_teams"])
        assert_plan(IncidentPlan.model_validate(plan), app.state.scenario, graph)
        # Reopening uses the same incident path; medical incident remains active.
        parser.parse.return_value = REPORTS[2]["expected"]
        reopened = client.post("/incident/parse", json={"report": REPORTS[2]["report"]})
        assert reopened.status_code == 200
        assert all(i["type"] == "MEDICAL_INCIDENT" for i in reopened.json()["incidents"])
        assert reopened.json()["evacuation_routes"] == baseline["evacuation_routes"]
        parser.parse.return_value = REPORTS[1]["expected"]
        hazard = client.post("/incident/parse", json={"report": REPORTS[1]["report"]})
        assert hazard.status_code == 200
        derived = derive_graph(graph, app.state.incidents.active)
        assert any(e["effective_travel_time"] > e["travel_time"] for _, _, e in derived.edges(data=True))
        assert not any(e["blocked"] for _, _, e in derived.edges(data=True))
        assert client.post("/incidents/reset").json() == baseline


@pytest.mark.skipif(not GRAPH_PATH.exists(), reason="Download Santa Rosa cache once")
def test_rescue_and_shelter_reference():
    graph = load_graph()
    report = "People are trapped at Shelter B."
    parser = fake_parser({"events": [{"type": "RESCUE_INCIDENT", "shelter": "Shelter B",
                                        "certainty": "confirmed", "evidence": report}]})
    with TestClient(create_app(lambda: graph, parser)) as client:
        response = client.post("/incident/parse", json={"report": report})
        assert response.status_code == 200
        plan = response.json()
        assert len(plan["rescue_teams"]) == 1 and plan["ambulances"] == []
        assert plan["metrics"]["active_rescue_incidents"] == 1
        assert plan["metrics"]["active_medical_incidents"] == 0
        assert plan["applied_events"][0]["latitude"] == 38.438
