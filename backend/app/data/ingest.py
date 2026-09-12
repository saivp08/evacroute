"""Explicit bounded data refresh: python -m app.data.ingest. Never run at startup."""

import json
import os
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

from app.data.census import CENSUS_GEO_URL, CENSUS_POP_URL, normalize_census, population_lookup
from app.data.fema import FEMA_URL, normalize_fema
from app.data.public_data import PROCESSED_PATH, supplement_shelters
from app.data.road_network import load_graph
from app.data.scenario import build_scenario

RAW_DIR = PROCESSED_PATH.parents[1] / "raw/public_data"


def fetch_json(url, params):
    response = requests.get(url, params=params, timeout=30)
    response.raise_for_status()
    payload = response.json()
    if isinstance(payload, dict) and (payload.get("error") or payload.get("exceededTransferLimit")):
        raise ValueError("External service error or truncated response")
    return payload


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def ingest(graph, processed_path=PROCESSED_PATH, raw_dir=RAW_DIR):
    raw_dir.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat()
    baseline = build_scenario(graph, use_public_data=False)
    previous = {}
    try:
        previous = json.loads(processed_path.read_text(encoding="utf-8"))
        if not isinstance(previous, dict):
            previous = {}
    except (OSError, ValueError):
        pass
    metadata = {"retrieved_at": now, "fema_url": FEMA_URL, "census_geography_url": CENSUS_GEO_URL,
                "census_population_url": CENSUS_POP_URL, "population_target": 2000}
    try:
        raw = fetch_json(FEMA_URL, {"where": "state='CA' AND UPPER(county_parish) LIKE '%SONOMA%'",
            "outFields": "shelter_id,shelter_name,address_1,city,county_parish,state,latitude,longitude,evacuation_capacity,post_impact_capacity,total_population,shelter_status_code",
            "outSR": "4326", "returnGeometry": "true", "f": "json"})
        save_json(raw_dir / "fema.json", raw)
        shelters = normalize_fema(raw, graph, now)
        metadata["fema"] = {"county_records": len(raw["features"]), "usable_location_records": len(shelters),
                            "reported_status_counts": dict(Counter(s.status for s in shelters)),
                            "planning_available_records": sum(s.planning_available for s in shelters)}
        if not shelters:
            raise ValueError("No usable FEMA records")
    except (requests.RequestException, ValueError, KeyError, TypeError):
        from app.models.scenario import Shelter
        try:
            shelters = [Shelter.model_validate(s) for s in previous.get("shelters", []) if not s.get("simulated", True)]
        except ValueError:
            shelters = []
        metadata["fema"] = {"fallback": "previous processed records" if shelters else "demo shelters", "refresh_failed": True}
    try:
        params = {"get": "NAME,P1_001N", "for": "tract:*", "in": "state:06 county:097"}
        if os.getenv("CENSUS_API_KEY"):
            params["key"] = os.environ["CENSUS_API_KEY"]
        raw_population = fetch_json(CENSUS_POP_URL, params)
        save_json(raw_dir / "census_population.json", raw_population)
        populations = population_lookup(raw_population)
        metadata["census_population_api"] = "2020 Decennial PL P1_001N"
    except (requests.RequestException, ValueError):
        populations = {}
        metadata["census_population_api"] = "unavailable; using official TIGERweb 2020 POP100 instead"
    try:
        xmin = min(n["x"] for _, n in graph.nodes(data=True)); xmax = max(n["x"] for _, n in graph.nodes(data=True))
        ymin = min(n["y"] for _, n in graph.nodes(data=True)); ymax = max(n["y"] for _, n in graph.nodes(data=True))
        raw = fetch_json(CENSUS_GEO_URL, {"where": "STATE='06' AND COUNTY='097'", "geometry": f"{xmin},{ymin},{xmax},{ymax}",
            "geometryType": "esriGeometryEnvelope", "inSR": "4326", "spatialRel": "esriSpatialRelIntersects",
            "outFields": "GEOID,TRACT,NAME,POP100,CENTLAT,CENTLON", "returnGeometry": "true", "outSR": "4326", "geometryPrecision": 6, "f": "json"})
        save_json(raw_dir / "census_geography.json", raw)
        zones = normalize_census(raw, populations, graph, now)
        metadata["census"] = {"intersecting_tracts": len(raw["features"]), "selected_tracts": len(zones),
                              "original_population_total": sum(z.original_population for z in zones),
                              "scale_factor": zones[0].population_scale_factor,
                              "selection": "2020 tracts containing the three original demo anchor points; use full tract population and Census centroid"}
    except (requests.RequestException, ValueError, KeyError, TypeError):
        from app.models.scenario import Zone
        try:
            zones = [Zone.model_validate(z) for z in previous.get("zones", [])] or baseline.zones
        except ValueError:
            zones = baseline.zones
        metadata["census"] = {"fallback": "previous processed records" if any(not z.simulated for z in zones) else "demo zones", "refresh_failed": True}
    shelters = supplement_shelters(shelters, baseline.shelters, zones)
    payload = {"schema_version": 1, "metadata": metadata, "zones": [z.model_dump(mode="json") for z in zones],
               "shelters": [s.model_dump(mode="json") for s in shelters]}
    # Never overwrite the known-good cache with an infeasible refresh.
    from app.optimization.evacuation import optimize_evacuation
    candidate = baseline.model_copy(update={"zones": zones, "shelters": shelters})
    try:
        optimize_evacuation(graph, candidate)
    except Exception:
        print("Refresh candidate failed planning validation; existing processed cache retained.")
        return None
    save_json(processed_path, payload)
    return payload


if __name__ == "__main__":
    load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False)
    result = ingest(load_graph())
    if result:
        print(json.dumps(result["metadata"], indent=2))
        print("Zones:", [(z["id"], z["original_population"], z["population"]) for z in result["zones"]])
        print("Shelters:", len(result["shelters"]), "real:", sum(not s["simulated"] for s in result["shelters"]))
