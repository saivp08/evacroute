# EvacRoute frontend handoff

Base URL: `http://127.0.0.1:8000`. Allowed origins: `http://localhost:3000` and `http://127.0.0.1:3000`; GET/POST and JSON headers are supported. Send `Content-Type: application/json` for bodies. Interactive exact schemas: `/docs`; machine-readable schema: `/openapi.json`.

Every coordinate array is **[latitude, longitude]**, including road geometry, evacuation routes, responder routes, and zone boundary rings. Site fields `latitude` and `longitude` are individual numbers. Distances are meters; times are seconds. IDs and OSM node IDs are strings.

| Method | Endpoint | Body | Successful response |
| --- | --- | --- | --- |
| GET | `/health` | none | `{"status":"ok"}` |
| GET | `/scenario` | none | Scenario below |
| POST | `/optimize` | none | Plan for current incident state |
| POST | `/incident` | Incident object below | Plan + `incident` + `affected_edge_ids` |
| GET | `/incidents` | none | `{"incidents":[ActiveIncident]}` |
| POST | `/incidents/reset` | none | Baseline plan, no active incidents |
| POST | `/incident/parse` | `{"report":"..."}` | Plan + parsing fields below |

All successful responses use HTTP 200. `/scenario` is a stable base map, not a live incident overlay. Draw active incidents and current route collections from the plan response. Replace those collections after each successful plan; do not append old routes.

## Scenario and IDs

```text
{
  scenario: {name, location, status, center, extent_m, node_count, edge_count,
             coordinate_order, data_note, attribution, attribution_url,
             data_mode, public_data_metadata},
  zones: [Site + {population, original_population, population_scale_factor,
                 population_is_scaled, geography, boundary}],
  shelters: [Site + {capacity, current_occupancy, status, planning_available,
                    address, evacuation_capacity, post_impact_capacity,
                    current_occupancy_is_assumed}],
  roads: [{id, source, target, name, road_type, length_m, speed_kph,
           travel_time_s, coordinates, simulated, data_source}],
  emergency_resources: [Site + {type, availability_status, response_capacity}]
}
Site = {id, name, latitude, longitude, graph_node, simulated,
        data_source, source_id, retrieved_at, field_sources}
```

Current snapshot: 1,662 nodes, 4,358 directed road edges, 3 zones, 28 shelters, 4 ambulances, 2 rescue teams. Zones are `zone-a`, `zone-b`, `zone-c`. Retained planning shelters are `shelter-a`, `shelter-b`, `shelter-c`; 25 real FEMA locations have stable `fema-<source ID>` IDs and are CLOSED. Read their exact IDs from `/scenario`, not array indexes. They receive no allocations. Available capacity is zero unless `planning_available=true`, then `max(0, capacity-current_occupancy)`.

Resources are `ambulance-1` through `ambulance-4`, and `rescue-team-1`, `rescue-team-2`. The scenario field is `emergency_resources`; planned dispatch fields are `ambulances` and `rescue_teams`. Resource type values are `ambulance` and `rescue_team`. Empty plan arrays mean no current dispatch, not a missing fleet.

`population` is scaled demo demand (997/560/443); `original_population` is real tract population (7,397/4,153/3,290). Read provenance per field. Full Census boundaries can extend beyond the road graph and are Leaflet rings, not GeoJSON. [Source details](app/data/README.md).

## Common plan response

```text
{
  evacuation_routes: [{id, zone, zone_name, shelter, shelter_name, people,
    travel_time_s, effective_travel_time_s, distance_m, coordinates, nodes, edge_ids}],
  ambulances: [ResponderRoute],
  rescue_teams: [ResponderRoute],
  shelter_assignments: [{shelter, shelter_name, assigned_people,
    remaining_capacity_after_assignment}],
  incidents: [ActiveIncident],
  dispatch_summary: [{incident_id, injuries, supported_injuries, uncovered_injuries,
    ambulances_dispatched, rescue_teams_required, rescue_teams_dispatched,
    unfilled_rescue_requests, status}],
  metrics: {
    total_evacuees, assigned_evacuees, total_available_shelter_capacity,
    average_travel_time_s, total_person_travel_time_s,
    average_effective_travel_time_s, total_person_effective_travel_time_s,
    active_medical_incidents, active_rescue_incidents,
    ambulances_dispatched, rescue_teams_dispatched,
    average_emergency_response_time_s, maximum_emergency_response_time_s,
    average_effective_emergency_response_time_s, uncovered_injuries,
    unfilled_rescue_requests
  }
}
ResponderRoute = {id, name, type, destination, incident_id, travel_time_s,
  effective_travel_time_s, distance_m, coordinates, nodes, edge_ids,
  response_capacity, simulated}
ActiveIncident = {id, type, severity, affected_edge_ids, zone,
  latitude, longitude, graph_node, injuries}
```

Route IDs use `route-<zone ID>-<shelter ID>`; responder route IDs are the resource IDs. Incident IDs are deterministic hashes of normalized targets (and road update type/severity). `nodes` and `edge_ids` describe the directed path. `travel_time_s` is base driving time; `effective_travel_time_s` includes simulated incident penalties. Neither is a live traffic ETA. Dispatch status is `covered`, `partial`, or `unserved`; unmet responder demand is reported without failing an otherwise feasible evacuation plan.

`POST /incident` adds `incident: ActiveIncident` (the submitted normalized update) and `affected_edge_ids: string[]`. A ROAD_REOPEN response includes its update under `incident` but does not retain a reopen event in active `incidents`.

`POST /incident/parse` adds:

```text
{
  original_report: string,
  parser: "anthropic",
  parsed_events: [{type, certainty, evidence, road_name, zone, shelter,
    latitude, longitude, injuries, severity, reason}],
  applied_events: [IncidentRequest],
  notes: string[]
}
```

Unused optional event fields are null. `certainty` is `confirmed` or `uncertain`; uncertain events are not applied. `applied_events` contains validated normalized requests, not active incident IDs. Missing parsed severity defaults to medium and is disclosed in `notes`. All applicable events in one report are atomic; unresolved/infeasible reports leave state unchanged.

## Requests and canonical demo

Use the default cached public-data profile. Start with `POST /incidents/reset`, then `POST /optimize` and retain that baseline.

Send `POST /incident/parse` with this exact body:

```json
{"report":"College Avenue is completely blocked by debris. Twelve people are injured in Zone C. This is a high-severity medical incident requiring urgent assistance."}
```

Expected extraction: ROAD_CLOSURE on **College Avenue**, plus high-severity MEDICAL_INCIDENT with 12 injuries at **zone-c**. Both Zone A routes change: `route-zone-a-shelter-a` and `route-zone-a-shelter-b`. Three ambulances (`ambulance-1`, `ambulance-3`, `ambulance-2`, in response-time order) and `rescue-team-1` dispatch. All evacuation and responder routes avoid the blocked directed edges. All 2,000 evacuees remain assigned within capacity.

Then send:

```json
{"report":"The debris has been cleared and College Avenue is open again."}
```

Evacuation routes return to baseline. Medical demand and dispatch remain active until `POST /incidents/reset`, which restores the complete baseline response.

Live OpenAI extraction cannot be guaranteed deterministic. The backend never substitutes a fake parser. With no key or provider outage, use these exact bodies in order at **POST /incident**:

```json
{"type":"ROAD_CLOSURE","road_name":"College Avenue","severity":"high"}
```
```json
{"type":"MEDICAL_INCIDENT","zone":"zone-c","injuries":12,"severity":"high"}
```
```json
{"type":"ROAD_REOPEN","road_name":"College Avenue"}
```

Finally `POST /incidents/reset`. This structured sequence is deterministic on the bundled snapshot. [demo_sequence.json](demo_sequence.json) is the shared fixture for documentation, smoke checks, and mocked-parser tests. Its `expected_events` are test expectations and are never a production parser fallback.

Other structured types: `HAZARD_UPDATE`, `ROAD_DAMAGE`, `DEBRIS`, `RESCUE_INCIDENT`. Road requests require exactly one of `edge_id`, `edge_ids`, `road_name`, or paired `latitude`/`longitude`; named roads affect every matching segment. Severity is `low|medium|high` and defaults to high on structured requests. Emergency requests require a zone ID or paired coordinates; medical requires positive integer `injuries`, rescue forbids it. Extra request fields are rejected. High-severity debris blocks roads; lower-severity debris/hazards/damage add cost. Reopen clears closures and blocking debris, preserving other cost effects.

## Errors and state

```json
{"error":{"code":"road_target_not_found","message":"No road named ..."},"detail":{"code":"road_target_not_found","message":"No road named ..."}}
```

Read `error.code` and `error.message`. Existing `detail` remains compatible: an object for domain errors, a field-error list for validation errors. Validation exposes `error.fields` with `loc`, `msg`, and `type`; submitted values are omitted.

| HTTP | Meaning / example codes |
| --- | --- |
| 404 | `road_target_not_found`, `incident_location_not_found`; unknown endpoint `http_error` |
| 409 | `insufficient_shelter_capacity`, `unreachable_shelter_capacity`, `optimization_failed`; candidate incident rejected atomically |
| 422 | `validation_error`, `unresolved_report_location` |
| 502 | `anthropic_api_error`, `anthropic_invalid_response`, `anthropic_ungrounded_event` |
| 503 | `anthropic_not_configured`, `anthropic_configuration_error`, `anthropic_unavailable`; provider rate limit |
| 504 | `anthropic_timeout` |
| 500 | `internal_error`; sanitized unexpected failure |

Incidents persist in memory in one backend process. Repeated planning does not consume shelters or responders. Repeated identical incidents are idempotent; updated injury counts replace demand at the same target. Reset and restart clear incidents. Use **one worker**, and disable auto-reload during the presentation. Concurrent mutations serialize under a lock; a slow OpenAI result applies when parsing finishes. Do not submit overlapping demo mutations from the UI. No durable incident store, authentication, or live resource tracking is provided.

## Setup, smoke checks, and measurements

From repository root in PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
# Only if .env does not exist:
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --env-file .env
```

No environment variables are required for the offline structured demo. Set `ANTHROPIC_API_KEY` in `.env` only for live parsing. Optional variables: `ANTHROPIC_MODEL`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_TIMEOUT_SECONDS`, `CENSUS_API_KEY` (manual refresh), `EVACROUTE_DATA_MODE` (default cached), and `EVACROUTE_PROCESSED_DATA_PATH`. Keep cached mode/default snapshot for the canonical sequence. Never send the OpenAI key to the frontend.

The committed 375 KB compressed OSM snapshot restores a missing/corrupt local GraphML cache offline. It contains the existing Santa Rosa road graph, not generated roads. If both local and bundled graph files are invalid, startup fails with a repair message; no fake graph is substituted. FEMA/Census processed-cache failures use labeled demo fallback, which keeps APIs usable but changes the canonical route expectations. Dependencies must still be installed on a clean machine.

In another terminal, from `backend`:

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
.\.venv\Scripts\python.exe smoke_test.py --output cache/task7_smoke.json
# Optional real provider check with a configured key:
.\.venv\Scripts\python.exe smoke_test.py --live-openai
```

Smoke tests reset incidents on the target server. They save baseline/updated routes when `--output` is supplied. The final suite passes 81 tests (two existing dependency deprecation warnings). Standard tests block external socket connections and use bundled data/mocks; no live provider is needed. Historical regression tests use the original demo profile; public-data and final integration tests use the current profile.

Measured on this Windows development machine during a live HTTP smoke run: `/scenario` about 107–108 ms; baseline `/optimize` 151–156 ms; `/incident` 234–312 ms. These are approximate local timings, including serialization and concurrent test activity, not throughput guarantees. With an injected test parser and no provider network, combined `/incident/parse` took about 454 ms and reopening took 255 ms. Each response includes `Server-Timing` for server processing. No route-engine rewrite or speculative caching was needed.

Task 7 preserves successful response fields and adds the shared `error` envelope plus `Server-Timing`. There are no intentional breaking API changes. Task 6 already changed zone centroids, populations, shelter count, and provenance. Live OpenAI was not validated during the provider migration; the canonical combined parsed path was validated with an injected test-only parser, and the structured sequence against a live local server.

Provider migration: `/incident/parse` now returns `parser: "anthropic"`; provider error codes use the `anthropic_` prefix. Configure `ANTHROPIC_API_KEY` and optional `ANTHROPIC_MODEL` (default `gpt-4.1-mini`), `ANTHROPIC_BASE_URL` (default `https://api.openai.com/v1`), and `ANTHROPIC_TIMEOUT_SECONDS` (default `30`). Old `GROK_` settings are ignored.
