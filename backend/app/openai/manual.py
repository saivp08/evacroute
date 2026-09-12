"""Optional real provider check: python -m app.openai.manual (never run by pytest)."""

import json
import os
from pathlib import Path

from dotenv import load_dotenv

from app.data.incidents import IncidentState, TargetNotFound
from app.data.road_network import load_graph
from app.data.scenario import build_scenario
from app.openai.client import OpenAIClient, OpenAIError
from app.openai.service import parse_and_apply
from app.optimization.evacuation import InfeasiblePlan


def main():
    load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False)
    if not os.getenv("OPEN_AI_API_KEY", "").strip():
        print("Live OpenAI check skipped: OPEN_AI_API_KEY is not set. No mock parser was used.")
        return 2
    report = json.loads(Path(__file__).with_name("demo_reports.json").read_text(encoding="utf-8"))[0]["report"]
    graph = load_graph()
    try:
        plan = parse_and_apply(report, graph, build_scenario(graph), IncidentState(), OpenAIClient())
    except (OpenAIError, TargetNotFound, InfeasiblePlan) as error:
        print(f"Live OpenAI check failed ({type(error).__name__}). No running server state was changed.")
        return 1
    print("LIVE OpenAI response, validated and applied to an isolated in-memory scenario:")
    print(plan.model_dump_json(include={"parser", "parsed_events", "applied_events", "notes", "metrics"}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
