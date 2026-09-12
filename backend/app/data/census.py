"""2020 tract population and geometry, scaled to a bounded demo demand."""

import math

from shapely.geometry import Point, Polygon
from app.models.scenario import Zone

CENSUS_GEO_URL = "https://tigerweb.geo.census.gov/arcgis/rest/services/Census2020/Tracts_Blocks/MapServer/0/query"
CENSUS_POP_URL = "https://api.census.gov/data/2020/dec/pl"
CENSUS_SOURCE = "U.S. Census Bureau 2020 Census (TIGERweb POP100)"


def population_lookup(payload):
    if not isinstance(payload, list) or not payload or not isinstance(payload[0], list):
        return {}
    output = {}
    for row in payload[1:]:
        try:
            item = dict(zip(payload[0], row))
            number = int(item["P1_001N"])
            if number >= 0:
                output[item["state"] + item["county"] + item["tract"]] = number
        except (KeyError, ValueError, TypeError):
            continue
    return output


def normalize_census(geography, populations, graph, retrieved_at, target_population=2000):
    from app.data.scenario import ZONE_SPECS, nearest_node
    if not isinstance(geography, dict) or not isinstance(geography.get("features"), list):
        raise ValueError("Malformed Census geography response")
    candidates = []
    for feature in geography.get("features", []):
        if not isinstance(feature, dict) or not isinstance(feature.get("attributes"), dict):
            continue
        try:
            a = feature["attributes"]
            rings = feature["geometry"]["rings"]
            if not rings or any(len(ring) < 4 or any(len(point) != 2 for point in ring) for ring in rings):
                continue
            rings = [[[float(x), float(y)] for x, y in ring] for ring in rings]
            if any(not (-180 <= x <= 180 and -90 <= y <= 90) for ring in rings for x, y in ring):
                continue
            if any(not Polygon(ring).is_valid for ring in rings):
                continue
            geoid = str(a["GEOID"])
            population = int(populations[geoid] if geoid in populations else a["POP100"])
            lat, lon = float(a["CENTLAT"]), float(a["CENTLON"])
            if population <= 0 or not (-90 <= lat <= 90 and -180 <= lon <= 180):
                continue
            candidates.append((geoid, a, rings, population, lat, lon))
        except (KeyError, ValueError, TypeError):
            continue
    chosen = []
    for id_, name, lat, lon, _ in ZONE_SPECS:
        matches = [record for record in candidates
                   if sum(Polygon(ring).covers(Point(lon, lat)) for ring in record[2]) % 2 == 1]
        if not matches:
            raise ValueError(f"No Census tract covers {id_}")
        record = min(matches, key=lambda r: r[0])
        if record[0] in [item[2][0] for item in chosen]:
            raise ValueError("Demo points must map to distinct Census tracts")
        chosen.append((id_, name.split(" — ")[0], record))
    total = sum(record[3] for _, _, record in chosen)
    scale = min(1.0, target_population / total)
    exact = [record[3] * scale for _, _, record in chosen]
    demand = [math.floor(value) for value in exact]
    for i in sorted(range(len(chosen)), key=lambda i: (-(exact[i] - demand[i]), chosen[i][0]))[:min(target_population, total) - sum(demand)]:
        demand[i] += 1
    zones = []
    for i, (id_, name, (geoid, a, rings, population, lat, lon)) in enumerate(chosen):
        source = "U.S. Census Bureau 2020 Decennial PL P1_001N" if geoid in populations else CENSUS_SOURCE
        zones.append(Zone(
            id=id_, name=f"{name} — {a['NAME']}", latitude=lat, longitude=lon,
            graph_node=str(nearest_node(graph, lat, lon)), population=demand[i],
            original_population=population, population_scale_factor=scale, population_is_scaled=scale != 1,
            geography="2020 census tract", boundary=[[(y, x) for x, y in ring] for ring in rings],
            simulated=False, data_source=source, source_id=geoid, retrieved_at=retrieved_at,
            field_sources={"geometry": "Census TIGERweb 2020 tract boundary and CENTLAT/CENTLON",
                           "original_population": source, "population": "proportional demo demand, largest-remainder rounding"},
        ))
    return zones
