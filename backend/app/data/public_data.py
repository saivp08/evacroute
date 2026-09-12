"""Offline processed-data loading, provenance, and explicit demo supplementation."""

import json
import logging
import os
from pathlib import Path

from pydantic import ValidationError

from app.models.scenario import Shelter, Zone

PROCESSED_PATH = Path(__file__).resolve().parents[3] / "datasets/processed/santa_rosa_public.json"
logger = logging.getLogger(__name__)


def supplement_shelters(real_shelters, fallback_shelters, zones):
    shelters = list(real_shelters)
    demand = sum(z.population for z in zones)
    # Retain the familiar three IDs when supplementation is necessary.
    if sum(s.available_capacity for s in shelters) < demand:
        existing = {s.id for s in shelters}
        shelters.extend(s.model_copy(deep=True) for s in fallback_shelters if s.id not in existing)
    shortfall = demand - sum(s.available_capacity for s in shelters)
    if shortfall > 0:
        fallback = next(s for s in shelters if s.simulated)
        fallback.capacity += shortfall
        fallback.field_sources["capacity"] = "EvacRoute demo fallback increased to ensure feasible demand"
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
        zones = [Zone.model_validate(row) for row in payload["zones"]]
        if not 3 <= len(zones) <= 8 or {z.id for z in zones} != {"zone-a", "zone-b", "zone-c"}:
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
        candidate.shelters = supplement_shelters(shelters, scenario.shelters, zones)
        # Validates directional reachability and aggregate allocation, not merely
        # total capacity. Reject stale/infeasible processed inputs safely.
        optimize_evacuation(graph, candidate)
        candidate.scenario.data_mode = "public_cached" if any(not z.simulated for z in zones) or any(not s.simulated for s in shelters) else "demo_fallback"
        candidate.scenario.public_data_metadata = payload.get("metadata", {})
        candidate.scenario.data_note = "Cached public data with per-field provenance; scaled evacuation demand and supplemental shelters/resources are demo assumptions. Closed FEMA shelters are not allocation destinations."
        logger.info("Loaded processed scenario: %d public zones, %d FEMA records, %d demo shelters",
                    sum(not z.simulated for z in zones), sum(not s.simulated for s in candidate.shelters), sum(s.simulated for s in candidate.shelters))
        return candidate
    except (OSError, ValueError, KeyError, TypeError, ValidationError, InfeasiblePlan):
        logger.warning("Processed public data missing/invalid/infeasible; using clearly labeled demo fallback")
        return scenario
