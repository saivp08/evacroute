"""Offline processed-data loading, provenance, and explicit demo supplementation."""

import json
import logging
import os
from pathlib import Path

from pydantic import ValidationError

from app.models.scenario import Shelter, Zone

PROCESSED_PATH = Path(__file__).resolve().parents[3] / "datasets/processed/santa_rosa_public.json"
logger = logging.getLogger(__name__)


def open_real_shelters(real_shelters):
    """Treats every real FEMA shelter as open for allocation, overriding the reported
    day-to-day CLOSED/dormant status — an explicit, deliberate operational assumption for
    this scenario (most public shelters sit dormant until an emergency actually activates
    them), not a claim about FEMA's real reported status. Real name/address/capacity are
    untouched; only the open/closed flag is overridden. Drops the three placeholder
    "Shelter A/B/C" demo records entirely — their combined real capacity (~9,700 across 25
    real Santa Rosa shelters) already covers the scenario's demand, so there's no longer a
    feasibility reason to pad the list with a fabricated fallback."""
    shelters = [s for s in real_shelters if not s.simulated]
    for shelter in shelters:
        shelter.planning_available = shelter.capacity > 0
        shelter.status = "OPEN"
        shelter.field_sources["status"] = "EvacRoute scenario assumption: treated as open for this exercise"
    return shelters


def use_processed_data(scenario, graph, path=None):
    from app.data.scenario import nearest_node
    from app.optimization.evacuation import InfeasiblePlan, optimize_evacuation
    if os.getenv("EVACROUTE_DATA_MODE", "cached") == "demo":
        logger.info("Explicit legacy demo data mode")
        return scenario
    path = Path(path or os.getenv("EVACROUTE_PROCESSED_DATA_PATH", str(PROCESSED_PATH)))
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict) or payload.get("schema_version") != 1:
            raise ValueError("Unsupported processed data version")
        if not isinstance(payload.get("metadata", {}), dict):
            raise ValueError("Invalid processed metadata")
        zones = [Zone.model_validate(row) for row in payload["zones"]]
        if len(zones) != 3 or {z.id for z in zones} != {"zone-a", "zone-b", "zone-c"}:
            raise ValueError("Invalid demo zone IDs/count")
        shelters = [Shelter.model_validate(row) for row in payload["shelters"]]
        if len({s.id for s in shelters}) != len(shelters):
            raise ValueError("Duplicate shelter IDs")
        latitudes = [node["y"] for _, node in graph.nodes(data=True)]
        longitudes = [node["x"] for _, node in graph.nodes(data=True)]
        for site in zones + shelters:
            if not min(latitudes) <= site.latitude <= max(latitudes) or not min(longitudes) <= site.longitude <= max(longitudes):
                raise ValueError("Processed point outside current graph")
            site.graph_node = str(nearest_node(graph, site.latitude, site.longitude))
        candidate = scenario.model_copy(deep=True)
        candidate.zones = zones
        candidate.shelters = open_real_shelters(shelters)
        # Validates directional reachability and aggregate allocation, not merely
        # total capacity. Reject stale/infeasible processed inputs safely.
        optimize_evacuation(graph, candidate)
        candidate.scenario.data_mode = "public_cached" if any(not z.simulated for z in zones) or any(not s.simulated for s in shelters) else "demo_fallback"
        candidate.scenario.public_data_metadata = payload.get("metadata", {})
        candidate.scenario.data_note = ("Cached public data with per-field provenance; scaled evacuation demand and "
                                       "emergency resources are demo assumptions. Real FEMA shelters are treated as "
                                       "open for this exercise, overriding their reported day-to-day closed status.")
        logger.info("Loaded processed scenario: %d public zones, %d FEMA shelters (all treated as open)",
                    sum(not z.simulated for z in zones), sum(not s.simulated for s in candidate.shelters))
        return candidate
    except (OSError, ValueError, KeyError, TypeError, ValidationError, InfeasiblePlan):
        logger.warning("Processed public data missing/invalid/infeasible; using clearly labeled demo fallback")
        return scenario
