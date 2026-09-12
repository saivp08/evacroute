# EvacRoute backend — Task 1

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

Initial real download: **1,662 nodes / 4,358 directed edges**. Counts may change after an intentional refresh. No optimization, incidents, routing, or frontend changes are included in Task 1.

Display the returned **© OpenStreetMap contributors** attribution with its link on the frontend map. Sources: [OSM attribution](https://www.openstreetmap.org/copyright), [OSMnx graph download and caching APIs](https://osmnx.readthedocs.io/en/stable/user-reference.html).
