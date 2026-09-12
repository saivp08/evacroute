"""Explicit demo smoke test. Resets server incidents; never a production mock parser."""

import argparse
import json
from pathlib import Path
from time import perf_counter

import httpx

DEMO = json.loads(Path(__file__).with_name("demo_sequence.json").read_text(encoding="utf-8"))
PLAN_FIELDS = {"evacuation_routes", "ambulances", "rescue_teams", "shelter_assignments", "incidents", "metrics", "dispatch_summary"}


def run(client, live_grok=False):
    timings = []
    def call(method, path, body=None):
        start = perf_counter()
        response = client.request(method, path, **({"json": body} if body is not None else {}))
        timings.append({"endpoint": f"{method} {path}", "elapsed_ms": round((perf_counter()-start)*1000, 2)})
        assert response.status_code == 200, f"{path}: {response.status_code} {response.text}"
        return response.json()

    assert call("GET", "/health") == {"status": "ok"}
    scenario = call("GET", "/scenario")
    assert scenario["scenario"]["data_mode"] == "public_cached", "Canonical demo requires the committed public profile"
    call("POST", "/incidents/reset")
    baseline = call("POST", "/optimize")
    assert call("POST", "/optimize") == baseline
    try:
        if live_grok:
            updated = call("POST", "/incident/parse", {"report": DEMO["report"]})
            assert {e["type"] for e in updated["parsed_events"]} == {"ROAD_CLOSURE", "MEDICAL_INCIDENT"}
        else:
            call("POST", "/incident", DEMO["closure"])
            updated = call("POST", "/incident", DEMO["medical"])
        assert PLAN_FIELDS <= updated.keys()
        changed = [r["id"] for r in updated["evacuation_routes"] if r not in baseline["evacuation_routes"]]
        assert set(changed) == {"route-zone-a-shelter-a", "route-zone-a-shelter-b"}
        assert len(updated["ambulances"]) == 3 and len(updated["rescue_teams"]) == 1
        blocked = {e for i in updated["incidents"] if i["type"] == "ROAD_CLOSURE" for e in i["affected_edge_ids"]}
        assert blocked
        for route in updated["evacuation_routes"] + updated["ambulances"] + updated["rescue_teams"]:
            assert not blocked.intersection(route["edge_ids"])
        assert updated["metrics"]["assigned_evacuees"] == 2000
        for shelter in scenario["shelters"]:
            assigned = sum(r["people"] for r in updated["evacuation_routes"] if r["shelter"] == shelter["id"])
            capacity = max(0, shelter["capacity"]-shelter["current_occupancy"]) if shelter["planning_available"] else 0
            assert assigned <= capacity
        for zone in scenario["zones"]:
            assert sum(r["people"] for r in updated["evacuation_routes"] if r["zone"] == zone["id"]) == zone["population"]
        repeat = call("POST", "/optimize")
        assert repeat == {key: updated[key] for key in baseline}
        assert call("GET", "/scenario") == scenario
        assert call("GET", "/incidents")["incidents"] == updated["incidents"]
        if live_grok:
            reopened = call("POST", "/incident/parse", {"report": DEMO["reopen_report"]})
            assert [e["type"] for e in reopened["parsed_events"]] == ["ROAD_REOPEN"]
        else:
            reopened = call("POST", "/incident", DEMO["reopen"])
        assert reopened["evacuation_routes"] == baseline["evacuation_routes"]
        assert len(reopened["ambulances"]) == 3  # Reopening a road doesn't clear medical demand.
    finally:
        reset = call("POST", "/incidents/reset")
    assert reset == baseline
    assert call("GET", "/incidents") == {"incidents": []}
    return {"mode": "live_grok" if live_grok else "structured", "timings": timings,
            "changed_route_ids": changed, "ambulance_ids": [r["id"] for r in updated["ambulances"]],
            "rescue_team_ids": [r["id"] for r in updated["rescue_teams"]],
            "baseline_routes": baseline["evacuation_routes"], "updated_routes": updated["evacuation_routes"]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--live-grok", action="store_true", help="Call the real configured parser instead of structured incidents")
    parser.add_argument("--output", type=Path, help="Optional full validation JSON, e.g. cache/task7_smoke.json")
    args = parser.parse_args()
    with httpx.Client(base_url=args.base_url, timeout=120) as client:
        result = run(client, args.live_grok)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({key: value for key, value in result.items() if not key.endswith("routes")}, indent=2))
