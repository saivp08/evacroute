# OpenAI report parsing — Task 5

OpenAI extracts events only. It never calculates routes, shelter assignments, or dispatch. `/incident/parse` validates the extraction and invokes the same atomic incident-batch function used by structured `/incident`.

## Configuration

Set these in `backend/.env` (the Uvicorn command below loads it):

```dotenv
OPEN_AI_API_KEY=your-key-here
OPEN_AI_BASE_URL=https://api.openai.com/v1
OPEN_AI_MODEL=gpt-4.1-mini
OPEN_AI_TIMEOUT_SECONDS=30
```

Only the key is required; the other values shown are defaults. Never commit the real `.env`. The base URL must be HTTPS and point to a trusted provider; the client sends its authorization header there. Use the default for OpenAI. No key is needed for health, scenario, structured incidents, optimization, or reset.

The client uses OpenAI's supported **POST `/v1/chat/completions`** API with `response_format.type=json_schema`, a Pydantic-generated JSON Schema, and `strict=true`. It uses a 30-second HTTP operation timeout (5-second connection timeout), no retries, no redirects, no tools, and no agent framework. Optional extraction fields are required on the wire and allow null, as required by OpenAI strict schemas. Model and endpoint availability are account/provider dependent; override `OPEN_AI_MODEL` when needed. HTTPX was already installed for tests and is now declared as a runtime dependency.

Official references: [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini). Live OpenAI parsing has not been verified during this migration.

## Request

```http
POST /incident/parse
Content-Type: application/json
```

```json
{
  "report": "Debris has completely blocked Bennett Valley Road. Twelve injuries are reported in Zone C; severity is high."
}
```

Reports must be nonempty and at most 8,000 characters. The provider receives the report plus a catalog of road names and zone/shelter names/IDs. It receives no graph topology, graph node IDs, edge IDs, resource positions, or calculated plans.

## Schema and normalization

The strict output envelope is `{"events":[...],"notes":[...]}` with at most 16 events. Each event has:

- `type`: ROAD_CLOSURE, ROAD_REOPEN, HAZARD_UPDATE, ROAD_DAMAGE, DEBRIS, MEDICAL_INCIDENT, or RESCUE_INCIDENT.
- `certainty`: `confirmed` or `uncertain`.
- `evidence`: a literal report excerpt, verified to occur in the original report.
- Exactly one target for a confirmed event: `road_name`, `zone`, `shelter`, or paired `latitude`/`longitude`.
- Optional `severity`: low/medium/high; null if not specified. Missing severity uses **medium demo severity**, with an explicit response note.
- `injuries`: positive integer required for a confirmed MEDICAL_INCIDENT; invalid for other types.
- Optional `reason`: short extracted explanation, never routing instructions.

Unknown fields, graph IDs, unsupported types, malformed coordinates, and invalid event combinations are rejected. The complete response is validated before any state mutation. JSON fences and free-form text are not repaired or guessed.

Zone/shelter references accept canonical IDs, full names, or short labels (`Zone C` → `zone-c`; `Shelter B` → the existing shelter coordinates). Emergency events at shelters are converted to coordinate-targeted structured incidents. Road events require a road or explicit coordinates, not a vague zone reference. Names match existing scenario roads; common unambiguous suffix abbreviations (`Road`/`Rd`, `Avenue`/`Ave`, etc.) are normalized before the existing resolver handles all named segments. There is no fuzzy matching, invented road alias, or nearest-road guess for vague text. `Highway 12` is not assumed to match a differently named road unless the scenario catalog establishes that name.

`SHELTER_CAPACITY_UPDATE` is deliberately unsupported. Reports such as “Shelter B is almost full” belong in notes; they cannot silently change occupancy or capacity. A model-produced unsupported event type rejects the response.

The system prompt in [prompt.py](prompt.py) treats reports as data, forbids following embedded instructions, forbids recommendations/planning, and requires preserving uncertainty. “Road near Zone A might be partially blocked” must not become an applied definite closure. Uncertain events remain in `parsed_events`, are excluded from `applied_events`, and produce a note. A report with no applicable events returns the unchanged current plan. `confirmed` means asserted in the report, not independently verified; schema/evidence validation cannot independently verify real-world facts or guarantee perfect model interpretation.

## Shared transaction and rescue semantics

`service.py` resolves references and passes normalized `IncidentRequest` objects to `app/optimization/planning.py::apply_incidents`. Structured POST `/incident` uses this same function. It stages events in reported order, derives the graph, plans evacuation and response, and commits the whole batch only if all steps succeed. A later bad location or infeasible evacuation rolls back the whole batch. The network call occurs outside the state lock; application operates on the latest state when the response arrives. Concurrent requests are serialized at application time.

`RESCUE_INCIDENT` is now supported in both parsed and structured requests. It takes a zone or coordinates, no injury count, and requests one available rescue team at any severity. It uses the existing severity-first, effective-cost dispatch and reports shortfalls. It does not independently request an ambulance. MEDICAL_INCIDENT behavior remains unchanged: four injured people per ambulance and one rescue team for high severity. A separate rescue and high-severity medical report at the same target can request two teams; the parser is instructed not to duplicate a single need. Rescue reports upsert per target with a `rescue-` ID prefix. `active_rescue_incidents` is an additive metric.

## Response

```text
{
  "original_report": "...",
  "parser": "openai",
  "parsed_events": [/* validated model events with certainty/evidence */],
  "applied_events": [/* normalized structured requests actually applied */],
  "notes": [...],
  "evacuation_routes": [...],
  "ambulances": [...],
  "rescue_teams": [...],
  "shelter_assignments": [...],
  "incidents": [...],
  "dispatch_summary": [...],
  "metrics": {...}
}
```

Existing map fields are unchanged, including **[latitude, longitude]** coordinates. Display uncertainty and notes separately from active incidents. `applied_events` describes the batch; `incidents` is the resulting full active state. Reset clears parsed and structured incidents alike. No occupancy or vehicle positions are consumed/advanced.

Errors use `{"detail":{"code":"...","message":"...","incidents_applied":false}}`:

| Status | Code / condition |
| --- | --- |
| 503 | `openai_not_configured`, invalid configuration, connection failure, or upstream rate limit |
| 504 | `openai_timeout` |
| 502 | `openai_invalid_response`, `openai_ungrounded_event`, or upstream API rejection/failure |
| 422 | `unresolved_report_location` |
| 409 | Existing evacuation infeasibility code; entire batch rejected |

Invalid user request bodies use FastAPI's normal 422 validation envelope. No production mock parser or silent fallback exists. When OpenAI fails, use structured `/incident`. Logs include report length, extraction event counts/types, and sanitized failure codes; they do not include credentials, report text, raw provider responses, or evidence text.

## Deterministic test/demo reports

[demo_reports.json](demo_reports.json) holds three fixed reports and **mocked expected fixtures**, not recorded/live OpenAI results:

1. “Debris has completely blocked Bennett Valley Road. Twelve injuries are reported in Zone C; severity is high.” → ROAD_CLOSURE + MEDICAL_INCIDENT.
2. “Wildfire is moving toward Bennett Valley Road, but the road is still open.” → HAZARD_UPDATE, no closure.
3. “The debris has been cleared and Bennett Valley Road is open again.” → ROAD_REOPEN.

Road-name targeting affects all **17 matching directed Bennett Valley Road edges** in the current cache. The closure remains evacuation-feasible and returns three ambulances and one rescue team for the medical report. El Rancho Way's single-edge Task 3 demo should not be replaced with a whole-road closure: closing every named segment can make evacuation infeasible. Live model wording, certainty, and extraction may vary; fixture expectations are deterministic only under mocks.

From `backend/`, run the application and tests:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --env-file .env
```

In another terminal, from `backend/`:

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
$body = @{report='Debris has completely blocked Bennett Valley Road. Twelve injuries are reported in Zone C; severity is high.'} | ConvertTo-Json
Invoke-RestMethod -Method Post http://localhost:8000/incident/parse -ContentType 'application/json' -Body $body
```

Optional **real provider** check (one request, isolated scenario; does not mutate the running server):

```powershell
.\.venv\Scripts\python.exe -m app.openai.manual
```

It loads `backend/.env`, explicitly skips without a key, and never uses mock results. Test fixtures and `httpx.MockTransport` keep the normal suite offline even if a developer has an API key.

Validation: **69 tests passed**, including all Task 1–4 tests and provider request/JSON/schema/error handling, parsed closure/medical/hazard/reopen/rescue, uncertainty, reference resolution, batch rollback, and reset on the cached real graph. Live HTTP checks verified missing-key 503 plus working health/scenario/structured dispatch/closure/optimization/reset. `pip check` passed. Two existing upstream deprecation warnings remain. **These are historical validation results; no live OpenAI request was performed during this migration.**

## Migration from Grok

Use `OPEN_AI_API_KEY` (exact spelling) and the `OPEN_AI_` settings above. Old `GROK_` settings are ignored. The parsing module is now `app.openai`; responses identify `parser: "openai"` and provider error codes use the `openai_` prefix. The optional smoke-test flag is now `--live-openai`.
