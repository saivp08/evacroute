# EvacRoute backend — Tasks 1–6

Task 6 defaults to cached Census zones and FEMA shelter records with explicit demo supplementation. See [public data sources, setup, provenance, and validation](app/data/README.md). Numerical examples below describe the historical demo profile unless stated otherwise; select it with `EVACROUTE_DATA_MODE=demo`.

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

Runtime-only installation uses `requirements.txt`. Only natural-language parsing requires `GROK_API_KEY`; all structured endpoints work without it. For macOS/Linux, substitute `python3`, `.venv/bin/python`, and `cp`.

The first startup downloads OSM data via Overpass and may take several minutes depending on the public service. Subsequent starts load `backend/cache/santa_rosa_drive_2500m_v1.graphml`, with no network request. The cache path is independent of the working directory and is already gitignored. OSMnx response caching lives under `backend/cache/overpass/`.

Startup fails with an error if the graph cannot be loaded or downloaded; it never substitutes fake roads. Retry startup if the initial public-service request fails. To deliberately refresh OSM data, stop the backend and remove the GraphML file and the `overpass/` response-cache directory, then restart. A corrupt GraphML cache likewise needs removal. Run one backend process for this demo; shared-cache multi-worker coordination is out of scope.

## API contract

- `GET /health` → `{"status":"ok"}`.
- `GET /scenario` → the structure below. Loaded once at startup and reused between requests.
- `POST /optimize` → a calculated evacuation plan for the built-in scenario; no request body required. See below.
- `POST /incident` → apply a structured road incident and return the recalculated plan.
- `POST /incident/parse` → interpret a natural-language report with Grok, validate it, and apply its incident batch. See [Task 5 setup and contract](app/grok/README.md).
- `GET /incidents` → current active incident effects.
- `POST /incidents/reset` → clear effects and return the baseline plan.
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

Initial real download: **1,662 nodes / 4,358 directed edges**. Counts may change after an intentional refresh. Task 2 adds evacuation routing and shelter assignment; Task 3 adds structured road incidents; Task 4 adds simulated emergency dispatch; Task 5 adds Grok report extraction and rescue incidents. External population/dataset ingestion and frontend changes remain out of scope.

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

## Task 3: dynamic road incidents

No new installed dependencies. The incident resolver uses the existing Shapely/pyproj geospatial dependencies. Run the backend with a **single worker**: incident state is in memory per process and is lost on restart or development reload. A process-local lock serializes incident updates, reset, and optimization so concurrent calls do not interleave state changes.

The original graph is treated as read-only, and the GraphML file is never updated. Each calculation copies the base graph, initializes neutral dynamic attributes, and overlays active effects. `/scenario` remains baseline map data. Use `/incidents` and `affected_edge_ids` to style incident roads against `/scenario.roads[].id`.

### Cost and lifecycle semantics

```text
effective_travel_time = base travel_time
                      × (1 + 4 × hazard_risk)
                      × damage_penalty
                      × debris_penalty
```

| Effect | Low | Medium | High |
| --- | --- | --- | --- |
| HAZARD_UPDATE: hazard_risk | 0.25 (2× cost) | 0.5 (3× cost) | 1 (5× cost) |
| ROAD_DAMAGE: damage_penalty | 1.5× | 2× | 4× |
| DEBRIS: debris_penalty | 2× | 5× | blocked |

Neutral defaults: `blocked=false`, `hazard_risk=0`, `damage_penalty=1`, `debris_penalty=1`. ROAD_CLOSURE blocks regardless of severity. Blocked edges are omitted from shortest-path routing, including parallel-edge selection. Both shortest paths and OR-Tools assignment use effective cost, rounded to milliseconds for flow costs. There is no traffic or road-capacity simulation.

Existing `travel_time_s` and travel-time metrics retain their free-flow meaning along the selected route. Additive fields `effective_travel_time_s` on routes and `average_effective_travel_time_s` / `total_person_effective_travel_time_s` in metrics report penalized cost, not measured travel time. At baseline these equal their existing counterparts.

Updates replace the effect of the **same type on each targeted edge**. Different effect types multiply together. An identical repeat produces the same normalized incident and plan; it never stacks duplicate penalties. A severity update replaces the old severity. When an update only overlaps part of an older incident, the older record retains only its unaffected edge IDs. IDs are stable hashes of normalized type, severity, and original affected edge IDs; this list is active state, not an event history.

ROAD_REOPEN removes closures and high-severity blocking debris on selected edges; it preserves hazards, damage, and nonblocking debris. Reopen is returned as the normalized action but is not retained as an active incident. Reset clears every effect, does not consume shelter space, and reproduces the baseline `/optimize` response exactly.

### Requests and responses

POST `/incident` accepts exactly one targeting format:

```json
{"type":"ROAD_CLOSURE","edge_id":"56073223:56093740:0","severity":"high"}
```

```json
{"type":"ROAD_DAMAGE","edge_ids":["56073223:56093740:0"],"severity":"medium"}
```

```json
{"type":"HAZARD_UPDATE","road_name":"El Rancho Way","severity":"high"}
```

```json
{"type":"DEBRIS","latitude":38.44,"longitude":-122.71,"severity":"low"}
```

Types and severity are case-sensitive; omitted severity defaults to `high`. Edge IDs target exact **directed** edges; reverse directions are not automatically included. An `edge_ids` list can explicitly select both directions. Road names match exactly, ignoring case and surrounding whitespace, including list-valued OSM names; **all matching segments and directions** are affected, not just the first match. Abbreviations such as `Ave` are not expanded; use names from `/scenario`.

Coordinates choose one nearest directed edge by metric geometry distance in Santa Rosa's UTM zone (EPSG:32610), with edge-ID tie breaking. Points farther than 150 meters from every edge are rejected. This lookup is for the Santa Rosa demo; it is not a global road resolver. Coordinate arrays in all responses remain **[latitude, longitude]**.

Successful HTTP 200 response has plan fields directly at the top level (not nested under `plan`):

```text
{
  "incident": {
    "id": "incident-...", "type": "ROAD_CLOSURE", "severity": "high",
    "affected_edge_ids": ["56073223:56093740:0"]
  },
  "affected_edge_ids": ["56073223:56093740:0"],
  "incidents": [/* normalized active incident records */],
  "evacuation_routes": [/* existing route fields + effective_travel_time_s */],
  "shelter_assignments": [/* unchanged contract */],
  "metrics": {/* existing metrics + effective cost metrics */}
}
```

GET `/incidents` returns `{"incidents":[...]}`. POST `/incidents/reset` takes no body and returns the baseline combined plan with `incidents: []`. POST `/optimize` always uses current incident effects while retaining its original evacuation fields and adding the Task 4 responder fields below.

Invalid structure/type/severity returns HTTP 422. Unknown road names, edge IDs, or distant coordinates return HTTP 404:

```json
{"detail":{"code":"road_target_not_found","message":"Unknown edge IDs: missing"}}
```

**Incident updates are atomic:** if the candidate effects make a complete plan infeasible, POST `/incident` returns HTTP 409 with the existing optimization error fields plus `"incident_applied": false`. The incident is rejected and the previously active state remains intact. The frontend must show that error and must not display the rejected closure as active. Reset remains available. No shelter occupancy changes between calls.

### Deterministic Santa Rosa closure demo

Use [demo_incident.json](demo_incident.json): **El Rancho Way, directed edge `56073223:56093740:0`**. This edge serves 850 baseline evacuees across both Zone B assignments. Closing it changes their geometry but preserves all zone-to-shelter population assignments.

| Route | People | Baseline seconds → closed seconds | Baseline meters → closed meters |
| --- | ---: | --- | --- |
| Zone B → Shelter B | 150 | 294.036 → 330.784 | 2788.552 → 3118.037 |
| Zone B → Shelter C | 700 | 205.401 → 242.150 | 1835.698 → 2165.183 |

Both detour from node `56073223` via `56073225` and `56093744`, rejoining at `56093740`. Other routes remain unchanged. Total assigned stays 2,000; available capacity stays 2,400. Mean time rises from 217.218 to 232.837 seconds; total person-time rises from 434,436.8 to 465,673.3 seconds. If the OSM cache is intentionally refreshed, revalidate the demo edge and results.

From `backend/`, with the server running:

```powershell
Invoke-RestMethod -Method Post http://localhost:8000/optimize
Invoke-RestMethod -Method Post http://localhost:8000/incident -ContentType 'application/json' -InFile demo_incident.json
Invoke-RestMethod http://localhost:8000/incidents
Invoke-RestMethod -Method Post http://localhost:8000/incidents/reset
Invoke-RestMethod -Method Post http://localhost:8000/optimize
```

Task 3 validation: **29 tests passed**, including all Task 1/2 tests, targeting, penalty composition, duplicate updates, partial reopen, blocked-edge exclusion, atomic failure, unchanged base graph/cache, and real demo reset. Live baseline/closure/reset JSON is saved locally in ignored `backend/cache/task3_*.json`; the post-reset response matches baseline exactly. Two upstream deprecation warnings remain.

## Task 4: emergency resource dispatch

No new dependencies. Four simulated ambulances and two simulated rescue teams are included in `GET /scenario.emergency_resources`. These illustrative staging points use the same road-node snapping as zones/shelters; they are not representations of actual emergency services or their availability.

| Resource | Staging area | Latitude | Longitude | Graph node | Response capacity |
| --- | --- | ---: | ---: | --- | --- |
| ambulance-1 | Central | 38.4380 | -122.7160 | 56040728 | 4 injured people |
| ambulance-2 | East | 38.4430 | -122.6930 | 56129478 | 4 injured people |
| ambulance-3 | Southwest | 38.4270 | -122.7310 | 56101610 | 4 injured people |
| ambulance-4 | Northwest | 38.4500 | -122.7300 | 56078315 | 4 injured people |
| rescue-team-1 | Central | 38.4380 | -122.7160 | 56040728 | 1 incident |
| rescue-team-2 | East | 38.4430 | -122.6930 | 56129478 | 1 incident |

Every resource includes `id`, `type` (`ambulance` or `rescue_team`), `name`, `latitude`, `longitude`, `graph_node`, `availability_status`, `response_capacity`, and `simulated: true`. All six start `available`; resources configured as `unavailable` are excluded. Resource positions and availability never change when a plan is calculated. There is no fleet-editing API or vehicle movement simulation.

### Medical report and dispatch rules

POST `/incident` accepts either a zone ID or coordinates:

```json
{"type":"MEDICAL_INCIDENT","zone":"zone-c","injuries":12,"severity":"high"}
```

```json
{"type":"MEDICAL_INCIDENT","latitude":38.43,"longitude":-122.699,"injuries":12,"severity":"high"}
```

`injuries` must be a positive integer; severity is `low`, `medium`, or `high` (default). Road selectors are not valid medical targets. A zone resolves to its existing graph node. Coordinates resolve to the nearest graph node within 500 meters; distant points or unknown zones return HTTP 404 with `incident_location_not_found`. Malformed requests return 422.

The normalized medical incident adds `zone` (or null), `latitude`, `longitude`, `graph_node`, and `injuries`; `affected_edge_ids` is empty because a medical report does not directly change roads. Zone C's demo ID is `medical-2aad36df9187577a`. Repeating a report for the same zone or the same coordinates rounded to six decimals updates that medical incident's injuries/severity rather than creating duplicate demand. Zone targeting and coordinate targeting are distinct identities; use one format consistently. Reports at different targets remain active together. Road updates preserve medical incidents, and reset clears both kinds.

Dispatch is deterministic greedy assignment, not a new OR-Tools model:

1. Process medical incidents by high → medium → low severity, then incident ID for ties.
2. For each incident, sort available, unused, reachable ambulances by effective route cost, then resource ID.
3. Assign until response capacity covers injuries or the reachable fleet is exhausted.
4. High-severity medical incidents additionally request one nearest available rescue team. Medium/low incidents do not request rescue support.

**Demo assumption: one ambulance supports four injured people.** Thus 12 injuries request three ambulances. This models response support, not patient transport seats, repeat trips, or clinical triage. A rescue team covers one high-severity incident and does not substitute for ambulance injury capacity. Each resource serves at most one incident per plan. This greedy method honors severity first; it does not claim global fleet-assignment optimality.

Both flows use the **same derived graph instance and shortest-path function**. One-way restrictions, parallel-edge selection, blocked roads, and hazard/damage/debris penalties apply identically. Dispatch starts at each resource's current fixed graph node and ends at the medical incident's graph node. Routes exclude off-road marker-to-node access. A co-located resource legitimately has zero travel time/distance.

Insufficient or unreachable responders **do not reject an otherwise feasible evacuation plan**. The medical incident remains active and the HTTP 200 response reports shortfalls in `dispatch_summary` and metrics. Each summary has `status` (`covered`, `partial`, or `unserved`), injury coverage, ambulance count, rescue demand/count, and unfilled requests. Do not interpret a successful request as full incident coverage. The existing HTTP 409 rollback behavior still applies when evacuation itself becomes infeasible.

### Combined API response additions

POST `/optimize`, POST `/incident`, and POST `/incidents/reset` all return the combined plan. All existing evacuation fields remain. `/incident` additionally retains its normalized `incident` and `affected_edge_ids` response fields.

```text
{
  "evacuation_routes": [...],
  "shelter_assignments": [...],
  "ambulances": [{
    "id": "ambulance-2", "name": string, "type": "ambulance",
    "destination": "medical-2aad36df9187577a",
    "incident_id": "medical-2aad36df9187577a",
    "travel_time_s": 182.439, "effective_travel_time_s": 182.439,
    "distance_m": 1773.709,
    "coordinates": [[latitude, longitude], ...],
    "nodes": [string, ...], "edge_ids": [string, ...],
    "response_capacity": 4, "simulated": true
  }],
  "rescue_teams": [/* same fields, type=\"rescue_team\" */],
  "incidents": [/* road and medical incidents */],
  "dispatch_summary": [{
    "incident_id": "medical-2aad36df9187577a", "injuries": 12,
    "supported_injuries": 12, "uncovered_injuries": 0,
    "ambulances_dispatched": 3, "rescue_teams_required": 1,
    "rescue_teams_dispatched": 1, "unfilled_rescue_requests": 0,
    "status": "covered"
  }],
  "metrics": {/* existing evacuation metrics plus emergency metrics */}
}
```

Emergency metrics are `active_medical_incidents`, `ambulances_dispatched`, `rescue_teams_dispatched`, `average_emergency_response_time_s`, `maximum_emergency_response_time_s`, `average_effective_emergency_response_time_s`, `uncovered_injuries`, and `unfilled_rescue_requests`. Response-time average is an unweighted average across all dispatched ambulance and rescue routes; maximum is the slowest dispatched resource. With no dispatch, both are zero; check coverage fields separately. Penalized effective time is a planning cost, not measured ETA.

Without medical incidents, responder arrays and `dispatch_summary` are empty and emergency metrics are zero. Reset produces this baseline exactly. In-memory/single-worker behavior is unchanged.

### Verified medical and responder-closure demo

Use [demo_medical_incident.json](demo_medical_incident.json) for Zone C, 12 injuries, high severity:

| Dispatched resource | Free-flow seconds | Distance (meters) |
| --- | ---: | ---: |
| ambulance-2 | 182.439 | 1773.709 |
| ambulance-1 | 183.836 | 2220.535 |
| ambulance-3 | 207.656 | 3501.952 |
| rescue-team-2 | 182.439 | 1773.709 |

Mean response time: **189.093 seconds**; maximum: **207.656 seconds**. All 12 injuries are supported, no rescue request is unfilled, and all 2,000 evacuees retain their Task 2 assignments.

Then apply [demo_responder_closure.json](demo_responder_closure.json): **Bennett Valley Road, edge `300788174:56152123:0`**. Ambulance 1 reroutes to 197.773 seconds / 2151.869 meters; ambulance 3 reroutes to 308.810 seconds / 5895.289 meters. Ambulance 2 and rescue team 2 remain unchanged. No returned responder or evacuation route uses the blocked edge. Mean response time becomes 217.865 seconds; maximum becomes 308.810 seconds. Full injury coverage and evacuation capacity constraints remain satisfied.

From `backend/`, with the server running:

```powershell
Invoke-RestMethod -Method Post http://localhost:8000/optimize
Invoke-RestMethod -Method Post http://localhost:8000/incident -ContentType 'application/json' -InFile demo_medical_incident.json
Invoke-RestMethod -Method Post http://localhost:8000/incident -ContentType 'application/json' -InFile demo_responder_closure.json
Invoke-RestMethod -Method Post http://localhost:8000/incidents/reset
```

Task 4 validation: **45 tests passed**, including all prior tests plus fleet appearance, injury-to-capacity rounding, unavailable resources, severity priority, unique assignments, shortfalls, shared dynamic penalties, medical target validation/upsert, real responder coordinates, closure rerouting, unchanged resource positions, and exact baseline restoration. Live JSON snapshots are saved in ignored `backend/cache/task4_*.json`. `pip check` passed. Two existing upstream deprecation warnings remain.

Task 5 validation: **69 tests passed**. See [Grok setup, schema, examples, failure behavior, and live-check instructions](app/grok/README.md). A real provider request remains unverified because no local Grok API key was configured.
