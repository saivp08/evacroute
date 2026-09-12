# Task 6: cached public data

The default scenario uses real OpenStreetMap roads, three 2020 Census tracts, and 25 FEMA shelter-location records. All 25 FEMA locations were reported CLOSED at retrieval, so none are allocation destinations. Three explicitly simulated shelters supplement them. Emergency vehicles, responder availability, evacuation demand, and fallback shelter capacities remain demo assumptions.

## Sources and selection

- [FEMA National Shelter System, Shelter Locations layer 5](https://gis.fema.gov/arcgis/rest/services/NSS/FEMA_NSS/FeatureServer/5): query Sonoma County, California. Of 168 returned records, 25 have usable coordinates inside the current graph bounds and within 500 meters of a graph node. Preserve source ID, name, address, reported status, evacuation/post-impact capacity, and occupancy when present. Only OPEN records with positive capacity and known occupancy are planning-available. Missing occupancy is explicitly flagged as assumed and prevents allocation. Reported capacities at CLOSED sites do not contribute available space.
- [Census 2020 TIGERweb tracts](https://tigerweb.geo.census.gov/arcgis/rest/services/Census2020/Tracts_Blocks/MapServer/0): 26 tracts intersect the road bounds. Select the tract containing each original demo anchor, then use its Census centroid, full boundary, and full tract population. Boundaries and population are not clipped to the road-network area.
- [2020 Decennial PL population API](https://api.census.gov/data/2020/dec/pl.html): ingestion attempts `P1_001N` by tract for state 06, county 097. The live request without a key returned a Missing Key HTML page. The committed cache therefore uses the official Census TIGERweb `POP100` field, not invented population. Optional `CENSUS_API_KEY` enables another attempt on refresh.

| Stable zone ID | Census tract GEOID | Original 2020 population | Scaled demo demand |
| --- | --- | ---: | ---: |
| zone-a | 06097153001 | 7,397 | 997 |
| zone-b | 06097152300 | 4,153 | 560 |
| zone-c | 06097151404 | 3,290 | 443 |
| Total | | 14,840 | 2,000 |

The common scale factor is `2000 / 14840 = 0.1347708894878706`; largest-remainder rounding preserves exactly 2,000 people. `population` remains the planner's demand. `original_population`, `population_scale_factor`, and `population_is_scaled` disclose the transformation.

The retained demo shelters are `shelter-a` (southwest, capacity 1,000), `shelter-b` (central, 900), and `shelter-c` (east, 800), each with simulated occupancy 100: 2,400 available places. If future real data cannot cover demand, ingestion supplements it with these labeled demo records; any further capacity increase is labeled in field provenance. Feasibility is checked with the real directed graph before saving.

## Refresh and offline behavior

Run from `backend` in PowerShell:

```powershell
.\.venv\Scripts\python.exe -m app.data.ingest
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --env-file .env
.\.venv\Scripts\python.exe -m pytest tests -q
```

No new dependencies were added. Copy `.env.example` to `.env` only if needed. `EVACROUTE_DATA_MODE=cached` is the default; `demo` selects the historical Tasks 1–5 scenario. Optional `EVACROUTE_PROCESSED_DATA_PATH` overrides the processed JSON path. Restart after refreshing data.

- `datasets/raw/public_data/`: ignored raw FEMA/Census responses, written only by manual ingestion.
- `datasets/processed/santa_rosa_public.json`: small versioned, committed normalized snapshot (about 106 KB), including retrieval timestamps and source metadata.
- `backend/cache/santa_rosa_drive_2500m_v1.graphml`: ignored OSM graph cache, 1,662 nodes and 4,358 directed edges in the current snapshot.
- Startup reads the processed snapshot without FEMA/Census network calls. A missing, malformed, or infeasible snapshot logs a warning and uses the labeled legacy demo scenario. Site nodes are re-snapped and allocation feasibility is checked against the loaded graph.
- Refresh failures retain previous processed source records where possible, otherwise labeled demo data. An infeasible refresh does not replace the existing processed cache. Public data can be stale; timestamps describe retrieval, not guaranteed present availability. Task 7 supplies a committed compressed OSM snapshot that restores a missing/corrupt graph cache offline; explicit fresh OSM downloads still require network access.

## Kincade inspection

[Zenodo record 7410114](https://zenodo.org/records/7410114) provides `data_routine_evacuation.xlsx` (12,888,979 bytes) and `data_routine_weeks.xlsx`. The evacuation workbook was downloaded and inspected programmatically as OOXML, without editing it. Its single sheet has 69,116 data rows and 28 columns: time, detector, scenario, detector health, and lane traffic measures including flow, occupancy, density, and speed in km/h.

No Kincade calibration or multiplier is applied. Detector-to-road matching, time-period selection, and quality filtering are needed before defensible calibration; the first inspected rows are labeled Routine. `datasets/processed/kincade_inspection.json` records the inspection and this limitation. The large workbook remains ignored under `datasets/raw/kincade/`.

```powershell
.\.venv\Scripts\python.exe -m app.data.inspect_kincade --download
```

The optional download validates the published MD5 before replacing the local file. It is never part of application startup.

## Frontend contract and provenance

Endpoints and top-level `GET /scenario` keys remain compatible: `scenario`, `zones`, `shelters`, `roads`, and existing responder collections. The default profile now returns 3 zones and 28 shelters. Keep IDs as strings; existing zone/fallback shelter IDs are preserved, but zone coordinates and baseline routes changed to Census centroids. FEMA IDs use the `fema-` prefix.

All coordinate arrays, including road geometry and zone boundary rings, use **[latitude, longitude]**. Boundary arrays are Leaflet coordinates, not GeoJSON. Individual site `latitude` and `longitude` fields remain available. A boundary may extend outside the road demo area.

Sites expose `data_source`, `source_id`, `retrieved_at`, `simulated`, and `field_sources`. Zones additionally expose original/scaled population and Census geography. A Census zone's `simulated=false` describes the source record; its scaled demand is explicitly marked separately. Shelters expose reported status, `planning_available`, reported capacity fields, and `current_occupancy_is_assumed`. Show closed locations distinctly; do not imply all map markers can accept evacuees. Roads identify OpenStreetMap as their source. Scenario metadata exposes `data_mode`, source counts, refresh fallback information, and scaling details.

Use `demo_public_closure.json` for the current profile: closing Eardley Avenue edge `56074847:56131839:0` changes the northwest evacuation routes. Earlier closure examples remain useful with `EVACROUTE_DATA_MODE=demo`.

## Verification

All 75 tests passed, including historical regression tests under the explicit legacy profile and public-data tests under the `public_data` marker. Tests cover normalization, malformed/missing data, refresh failure, offline loading, graph nodes, capacity, full allocation, closed-shelter exclusion, closure/reset, medical dispatch, and mocked Grok resolution against Census zones.

Manual checks used the real cached graph and live local HTTP server: health, scenario JSON, 2,000-person optimization, changed routes after closure, medical responder assignment, and exact baseline restoration after reset. `pip check` passed. No live Grok request was made because no API key was configured; mock tests do not replace production Grok calls.
