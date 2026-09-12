"""Normalize NSS records without presenting closed/unknown sites as available."""

import math

import osmnx as ox

from app.models.scenario import Shelter

FEMA_URL = "https://gis.fema.gov/arcgis/rest/services/NSS/FEMA_NSS/FeatureServer/5/query"
FEMA_SOURCE = "FEMA National Shelter System"


def nonnegative_int(value):
    try:
        number = float(value)
        return int(number) if math.isfinite(number) and number >= 0 and number.is_integer() else None
    except (ValueError, TypeError):
        return None


def normalize_fema(payload, graph, retrieved_at):
    from app.data.scenario import nearest_node
    if not isinstance(payload, dict) or not isinstance(payload.get("features"), list):
        raise ValueError("Malformed FEMA response")
    latitudes = [n["y"] for _, n in graph.nodes(data=True)]
    longitudes = [n["x"] for _, n in graph.nodes(data=True)]
    output = {}
    for feature in payload.get("features", []):
        if not isinstance(feature, dict) or not isinstance(feature.get("attributes"), dict):
            continue
        try:
            a = feature["attributes"]
            geometry = feature.get("geometry") or {}
            if not isinstance(geometry, dict):
                geometry = {}
            lat = float(a.get("latitude") if a.get("latitude") is not None else geometry.get("y"))
            lon = float(a.get("longitude") if a.get("longitude") is not None else geometry.get("x"))
            if not (min(latitudes) <= lat <= max(latitudes) and min(longitudes) <= lon <= max(longitudes)):
                continue
            if not a.get("shelter_name") or a.get("shelter_id") is None:
                continue
            node = nearest_node(graph, lat, lon)
            if ox.distance.great_circle(lat, lon, graph.nodes[node]["y"], graph.nodes[node]["x"]) > 500:
                continue
            evac = nonnegative_int(a.get("evacuation_capacity"))
            post = nonnegative_int(a.get("post_impact_capacity"))
            capacity = evac if evac else post or 0
            occupancy = nonnegative_int(a.get("total_population"))
            status = str(a.get("shelter_status_code") or "UNKNOWN").upper()
            source_id = str(a["shelter_id"])
            output[source_id] = Shelter(
                id=f"fema-{source_id}", name=str(a["shelter_name"]), latitude=lat, longitude=lon,
                graph_node=str(node), capacity=capacity, current_occupancy=occupancy or 0,
                evacuation_capacity=evac, post_impact_capacity=post, status=status,
                planning_available=status == "OPEN" and capacity > 0 and occupancy is not None,
                current_occupancy_is_assumed=occupancy is None,
                address=", ".join(str(a[k]) for k in ("address_1", "city", "state") if a.get(k)),
                simulated=False, data_source=FEMA_SOURCE, source_id=source_id, retrieved_at=retrieved_at,
                field_sources={"location": FEMA_SOURCE, "status": FEMA_SOURCE,
                               "capacity": "evacuation_capacity" if evac else "post_impact_capacity" if post else "missing/zero; unavailable",
                               "current_occupancy": "total_population" if occupancy is not None else "unknown; placeholder 0, not available"},
            )
        except (KeyError, ValueError, TypeError):
            continue
    return [output[key] for key in sorted(output)]
