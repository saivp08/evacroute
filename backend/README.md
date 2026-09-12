# EvacRoute backend — Tasks 1 and 2

Real OpenStreetMap driving roads for a roughly 5 × 5 km bounding box around downtown Santa Rosa, California (center `38.4404, -122.7141`). OSMnx keeps the largest weakly connected component and simplifies road geometry. This covers a bounded demo area, not all of Santa Rosa.

## Install and run

From the repository root in PowerShell (Python 3.11+; verified with 3.14.6):

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
# Only if .env does not already exist:
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --env-file .env
```

Runtime-only installation uses `requirements.txt`. No API key is required. For macOS/Linux, substitute `python3`, `.venv/bin/python`, and `cp`.

The first startup downloads OSM data via Overpass and may take several minutes depending on the public service. Subsequent starts load `backend/cache/santa_rosa_drive_2500m_v1.graphml`, with no network request. The cache path is independent of the working directory and is already gitignored. OSMnx response caching lives under `backend/cache/overpass/`.

Startup fails with an error if the graph cannot be loaded or downloaded; it never substitutes fake roads. Retry startup if the initial public-service request fails. To deliberately refresh OSM data, stop the backend and remove the GraphML file and the `overpass/` response-cache directory, then restart. A corrupt GraphML cache likewise needs removal. Run one backend process for this demo; shared-cache multi-worker coordination is out of scope.

## API contract

- `GET /health` → `{"status":"ok"}`.
- `GET /scenario` → the structure below. Loaded once at startup and reused between requests.
- `POST /optimize` → a calculated evacuation plan for the built-in scenario; no request body required. See below.
- Interactive schema: http://localhost:8000/docs.
- Allowed browser origins: `http://localhost:3000` and `http://127.0.0.1:3000`.

```text
{
  "scenario": {
    "name": string, "location": string, "status": "ready",
    "center": [latitude, longitude], "extent_m": 2500,
    "node_count": integer, "edge_count": integer,
    "coordinate_order": "latitude, longitude",
    "data_note": string, "attribution": string, "attribution_url": string
  },
  "zones": [{
    "id": string, "name": string,
    "latitude": number, "longitude": number, "graph_node": string,
    "population": integer, "simulated": true
  }],
  "shelters": [{
    "id": string, "name": string,
    "latitude": number, "longitude": number, "graph_node": string,
    "capacity": integer, "current_occupancy": integer, "simulated": true
  }],
  "roads": [{
    "id": string, "source": string, "target": string,
    "name": string, "road_type": string,
    "length_m": number, "speed_kph": number, "travel_time_s": number,
    "coordinates": [[latitude, longitude], ...]
  }]
}
```

**All coordinate arrays are `[latitude, longitude]` in WGS84**, ready for Leaflet polylines. These are not GeoJSON coordinates; reverse pairs if constructing GeoJSON/Mapbox features. Site markers use `[site.latitude, site.longitude]`. `extent_m` is the distance from center to each bounding-box side, not the full width.

Node identifiers are strings to avoid JavaScript integer-precision issues. Road IDs are opaque unique strings formed from source, target, and the parallel-edge key; IDs are stable for this cached graph, not guaranteed across fresh OSM downloads. Roads are directed edges: a two-way street may have overlapping polylines in both directions. No raw graph or full node list is serialized. Geometry is rounded to six decimal places; distances/times to two. HTTP gzip compression is enabled for clients that accept it.

Roads include OSM length, tagged/imputed speed in km/h, and free-flow travel time in seconds. OSMnx interprets mph tags, imputes by road type, and uses a 30 km/h fallback for unknown types. Defined road-class defaults range from 15 km/h for living streets to 100 km/h for motorways. These are estimates, not live traffic measurements. Full original geometry remains in the graph cache.

## Simulated scenario

All points are illustrative demo locations, **not official shelters or evacuation zones**. Coordinates are manually chosen inside the demo region; `graph_node` is their nearest retained OSM node by great-circle distance. The marker remains at the chosen point rather than moving to that node.

| Zone | Latitude | Longitude | Simulated population |
| --- | --- | --- | --- |
| Zone A — Northwest demo | 38.4500 | -122.7300 | 600 |
| Zone B — Northeast demo | 38.4530 | -122.7000 | 850 |
| Zone C — Southeast demo | 38.4300 | -122.6990 | 550 |

| Shelter | Latitude | Longitude | Simulated capacity | Simulated occupancy |
| --- | --- | --- | --- | --- |
| Shelter A — Southwest demo | 38.4270 | -122.7310 | 1,000 | 100 |
| Shelter B — Central demo | 38.4380 | -122.7160 | 900 | 100 |
| Shelter C — East demo | 38.4430 | -122.6930 | 800 | 100 |

Total population: **2,000**. Total capacity: **2,700**; available space after occupancy: **2,400**. Census/FEMA data are not integrated.

## Validation

From `backend/`:

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
.\.venv\Scripts\python.exe -m pip check
Invoke-RestMethod http://localhost:8000/health
Invoke-RestMethod http://localhost:8000/scenario
```

Tests use a tiny offline graph for health, API contract, CORS, geometry, speed fallback, demand/capacity, and cache round trips. If the real GraphML cache exists, the integration test also verifies its endpoint and site-node membership/proximity while forbidding OSM downloads; otherwise that test is explicitly skipped. Start the backend once to populate it before running the full suite.

Initial real download: **1,662 nodes / 4,358 directed edges**. Counts may change after an intentional refresh. Task 2 adds evacuation routing and shelter assignment; incidents, emergency resources, and frontend changes remain out of scope.

Display the returned **© OpenStreetMap contributors** attribution with its link on the frontend map. Sources: [OSM attribution](https://www.openstreetmap.org/copyright), [OSMnx graph download and caching APIs](https://osmnx.readthedocs.io/en/stable/user-reference.html).

## Task 2: evacuation plan

Update dependencies with `.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt`. OR-Tools `9.15.6755` is the only additional direct dependency for Task 2.

```powershell
Invoke-RestMethod -Method Post http://localhost:8000/optimize
```

Successful response (HTTP 200):

```text
{
  "evacuation_routes": [{
    "id": "route-zone-a-shelter-b",
    "zone": "zone-a", "zone_name": string,
    "shelter": "shelter-b", "shelter_name": string,
    "people": integer, "travel_time_s": number, "distance_m": number,
    "coordinates": [[latitude, longitude], ...],
    "nodes": [string, ...], "edge_ids": [string, ...]
  }],
  "shelter_assignments": [{
    "shelter": string, "shelter_name": string,
    "assigned_people": integer,
    "remaining_capacity_after_assignment": integer
  }],
  "metrics": {
    "total_evacuees": integer, "assigned_evacuees": integer,
    "total_available_shelter_capacity": integer,
    "average_travel_time_s": number,
    "total_person_travel_time_s": number
  }
}
```

NetworkX Dijkstra computes travel-time shortest paths from each zone to every shelter over the directed OSM network. For parallel edges, the selected minimum-time edge supplies both geometry and distance, with edge key breaking equal-time ties. Sorted graph/zone/shelter insertion makes repeated calculations deterministic for the same static input and pinned solver. Reversed edge geometry is oriented in travel direction before stitching.

[OR-Tools `SimpleMinCostFlow`](https://developers.google.com/optimization/flow/mincostflow) performs the assignment. Each zone supplies its population; each reachable zone-to-shelter arc has capacity equal to that zone's population and unit cost equal to shortest-path travel time rounded to milliseconds. Each shelter has a zero-cost arc to a common sink, capped at `max(0, capacity - current_occupancy)`. The sink demands the full evacuation population. Integer flow allows zones to split across shelters while minimizing total person-travel time at millisecond precision. Unreachable pairs are omitted. This optimizes shelter capacity only, with no road-capacity or congestion constraints.

The API computes paths and allocation per POST (only nine pairs); it does not change zone populations, shelter occupancy, graph data, or `/scenario`. Calling it repeatedly does not consume capacity. Metrics use people-weighted route times; average travel time is not an evacuation clearance time. All routes with positive assigned population are returned, and every shelter gets a summary including shelters assigned zero people.

Frontend notes:

- `zone` and `shelter` match `/scenario` IDs. Display the separate name fields as labels.
- Coordinate pairs remain **[latitude, longitude]**. Route endpoints are the sites' **snapped graph nodes**, not necessarily their manually placed marker coordinates. No off-road connector segment is invented, and travel estimates exclude marker-to-road access.
- `nodes` and `edge_ids` are strings and can be ignored for drawing. Coordinates retain full road shape rounded to six decimals; travel time and distance are rounded to three decimals.
- Co-located zone/shelter nodes legitimately produce zero travel time/distance with a duplicate two-point coordinate array. All assigned routes in the current Santa Rosa scenario have positive distance and time.
- Local CORS now allows GET and POST, including preflight requests. No body or credentials are required.

Infeasibility returns **HTTP 409**, not a partial plan or an opaque server error:

```json
{
  "detail": {
    "code": "insufficient_shelter_capacity",
    "message": "Evacuation demand exceeds available shelter space by 100 people.",
    "total_evacuees": 2000,
    "total_available_shelter_capacity": 1900
  }
}
```

`unreachable_shelter_capacity` means aggregate space exists but directed road connectivity makes a complete assignment infeasible. `optimization_failed` reports other non-optimal solver statuses. All use the same documented error envelope.

### Verified cached Santa Rosa result

| Zone | Shelter | People | Travel time (seconds) | Distance (meters) |
| --- | --- | ---: | ---: | ---: |
| A | B | 600 | 203.993 | 2332.819 |
| B | B | 150 | 294.036 | 2788.552 |
| B | C | 700 | 205.401 | 1835.698 |
| C | A | 500 | 228.760 | 3680.580 |
| C | B | 50 | 195.498 | 2114.224 |

Metrics: 2,000 evacuees, 2,000 assigned, 2,400 initially available spaces, 217.218 seconds average travel time, 434,436.8 person-seconds total. Post-assignment free space is A: 400, B: 0, C: 0. Fresh OSM downloads may change these results.

Task 2 validation: **11 tests passed**, including the real cached scenario, capacity and per-zone conservation, optimality against an exhaustive tiny-case oracle, split zones, directed reachability failure, parallel edges, reversed/multi-edge geometry, repeated identical responses, unchanged scenario state, CORS, zero demand, and co-located sites. Live startup, health, JSON response, route endpoints, capacities, and `pip check` also passed. Two existing upstream Starlette/httpx deprecation warnings remain.
