# Frontend/backend integration

The existing overview now uses the FastAPI backend. No backend code or provider configuration was changed in this integration. The layout, panels, dark map, and navigation remain in place. The active overview had no planning/reset actions or report form, so it now exposes the requested optimization/reset buttons and reuses the existing report-input component.

## Contract audit

| Previous frontend assumption | Actual backend / integration |
| --- | --- |
| Mock services, Pittsburgh map center | GET /scenario; use scenario.center (Santa Rosa) |
| Object coordinates, one zone boundary | Wire coordinates remain [latitude, longitude]; one adapter converts to existing UI objects; every boundary ring is rendered |
| Placeholder IDs and locally matched routes | Preserve opaque zone, FEMA shelter, edge, route, resource, and incident IDs; draw backend coordinates |
| Independent map/panel fetches | A shared OperationsProvider owns one scenario and plan; all panels and layers update together |
| occupancy and open/full flags | current_occupancy plus assigned_people, explicitly labeled Current + planned; planning_available controls eligibility |
| Fake fire/police vehicles | emergency_resources supports ambulance and rescue_team; responder route IDs match resource IDs |
| Moving vehicles and ticking ETA | Fixed resource positions with assigned status and backend effective travel-time estimates; no invented telemetry |
| Static road status | affected_edge_ids joins active incidents to roads; closures/high debris block, hazards/damage/other debris restrict; Leaflet layers refresh status styling on reset |
| Client-side report parser | POST /incident/parse with exactly {"report":"..."}; backend owns OpenAI and replanning |
| Mock flow/bottleneck metrics | Actual assigned evacuees, mean effective evacuation ETA, mean effective response ETA, and dispatch counts/uncovered demand |
| Invented incident timestamps and evacuation orders | Missing timestamps say Not provided; zones indicate planning status, not official evacuation orders |
| Assumed nonempty geometry/resources | Invalid geometry is omitted without connecting across gaps; empty routes/resources and nullable addresses/incident locations are handled |

GET /health, GET /scenario, GET /incidents, POST /optimize, POST /incident, POST /incident/parse, and POST /incidents/reset are available through dataService.ts. Initial load obtains health/scenario and then optimizes to restore current server state on refresh. Explicit optimization does not mutate incidents. Mutation controls are disabled while requests run. Failed reports remain in the textarea, and failures leave the last displayed plan intact. A failed initial connection offers Retry connection.

There were no structured-incident controls in the active frontend. The existing documented structured API demo is preserved; no new structured-control product UI was added.

## Environment and startup

From the repository root, use separate PowerShell terminals. Existing local services are running at http://127.0.0.1:3000 and http://127.0.0.1:8000.

Backend:

```powershell
cd backend
# First-time setup only, if dependencies are missing:
# python -m venv .venv
# .\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
# Copy .env.example to .env only if .env does not exist.
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --env-file .env
```

Frontend:

```powershell
cd frontend
npm.cmd ci
# Copy .env.local.example to .env.local only if .env.local does not exist.
npm.cmd run dev -- --hostname 127.0.0.1
```

frontend/.env.local:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

backend/.env retains the existing exact name OPEN_AI_API_KEY. The pasted task's OPENAI_API_KEY spelling does not replace that project setting. Optional existing backend settings: OPEN_AI_MODEL, OPEN_AI_BASE_URL, OPEN_AI_TIMEOUT_SECONDS. The frontend never reads or sends the provider key and never calls OpenAI. No secrets or local environment files are committed. Restart the frontend after changing its URL; production bundles require rebuilding after URL changes.

Use one backend worker. Omit --reload for a stable demo; it is optional for development and restarts clear in-memory incidents. Existing CORS allows localhost:3000 and 127.0.0.1:3000. No CORS changes were needed.

## Demo that works without provider access

1. Open http://127.0.0.1:3000. The real scenario loads: 4,358 directed road edges, 3 zones, 28 shelters, 6 emergency resources, and 4 baseline evacuation routes for 2,000 people.
2. Click Run optimization to refresh the current plan.
3. From a repository-root PowerShell terminal, apply the canonical structured incidents:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/incident -ContentType 'application/json' -Body '{"type":"ROAD_CLOSURE","road_name":"College Avenue","severity":"high"}'
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/incident -ContentType 'application/json' -Body '{"type":"MEDICAL_INCIDENT","zone":"zone-c","injuries":12,"severity":"high"}'
```

4. Click Run optimization. College Avenue turns red; route-zone-a-shelter-a and route-zone-a-shelter-b change. Three ambulance routes and one rescue-team route appear. Assigned evacuees remain 2,000 and planned response ETA/dispatch coverage update.
5. Click Reset incidents. The backend returns the exact baseline; road markings, incident markers, responder routes, and extraction notes clear.

An automated version, including reopening the road and checking exact reset equality, is available from backend/:

```powershell
.\.venv\Scripts\python.exe smoke_test.py --output cache/integration-structured.json
```

## Natural-language path and live limitation

Paste this into Report an emergency update and click Submit report:

> College Avenue is completely blocked by debris. Twelve people are injured in Zone C. This is a high-severity medical incident requiring urgent assistance.

The live browser request reached POST /incident/parse and the existing backend contacted OpenAI. OpenAI returned HTTP 429; the backend correctly returned HTTP 503 / openai_api_error with incidents_applied=false. The UI displayed the error and retained the report. A successful live extraction could not be validated. Check the OpenAI account's quota/billing/rate-limit status and retry once resolved. No automatic provider fallback or repeated live retries were added.

The browser's successful parsed-response UI path was separately tested with an explicitly test-only replay of a real structured plan plus canonical extraction fixtures. That replay is not evidence of a successful live OpenAI extraction and is not present in production code.

## Validation

- Backend: .\.venv\Scripts\python.exe -m pytest -q -- 82 passed; two existing upstream deprecation warnings.
- Frontend: npm.cmd run typecheck -- passed.
- Frontend: npm.cmd test -- four contract tests passed (IDs/coordinates/assignments, road/responder/reset normalization, invalid/empty geometry, API methods/bodies/error handling).
- Frontend: npm.cmd run build -- production build passed.
- Lint: no lint script/configuration exists; none was introduced.
- Headless Edge on the actual frontend/backend: scenario layers, baseline optimization, structured closure/medical updates, route changes, responder overlays, metrics, and reset passed. No browser CORS, hydration, or JavaScript runtime errors were observed. The expected provider-error response and an existing missing favicon generated network console messages.
- Additional test-only browser checks: initial backend connection failure/retry, empty arrays, parsed-response success handling, and report preservation after provider errors passed.
- Local ignored evidence: backend/cache/browser-integration.json, baseline.png, structured.png, reset.png, and integration-structured.json. Temporary Playwright tooling was installed without changing project dependencies or the lockfile.

## Mock usage and scope

No mock or static snapshot data feeds the active app. frontend/lib/mock/index.ts remains as clearly marked archived visual fixtures, with no imports from the live API/UI. The old unrouted components/dashboard/Dashboard.tsx, lib/scenario.ts, lib/incidentParser.ts, and lib/data files remain an explicitly identified legacy snapshot demo. app/page.tsx uses AppShell/OverviewScreen, not that dashboard. No silent fallback is enabled.

Navigation placeholders remain as they were; no extra product screens were built. The backend has no hospital/fire-station/police-station collections or live telemetry, so these are not fabricated. Road basemap tiles still depend on the existing external tile service. Incidents remain in-memory and updates from another browser require Run optimization or a page reload. npm reported one high-severity dependency finding during install; dependency remediation is outside this integration's scope. Nonblocking Next.js parent-lockfile and Node test-module warnings remain.

## Files changed

- Root documentation: README.md, INTEGRATION.md.
- API/state/types: frontend/lib/services/apiTypes.ts, dataService.ts, normalize.ts, OperationsProvider.tsx; frontend/lib/models/index.ts; frontend/lib/useRelativeTime.ts.
- Active shell: frontend/components/shell/AppShell.tsx, StatusBar.tsx.
- Overview panels: frontend/components/overview/OverviewScreen.tsx, MetricsStrip.tsx, EmergencyFleetPanel.tsx, EvacuationStatusPanel.tsx, ShelterCapacityPanel.tsx.
- Report input: frontend/components/panels/IncidentInput.tsx.
- Map: frontend/components/map/BaseMap.tsx, RoadLayer.tsx, RoadLayerLoader.tsx, InfrastructureLayer.tsx, InfrastructureLayerLoader.tsx, VehicleLayer.tsx, markerIcons.ts; new PlanLayer.tsx and PlanLayerLoader.tsx.
- Environment/style/tests: frontend/.env.local.example, frontend/app/globals.css, frontend/package.json, frontend/tests/integration.test.mjs.
- Archive clarification only: frontend/components/dashboard/Dashboard.tsx, frontend/lib/scenario.ts, frontend/lib/mock/index.ts.
- No backend source, dependency, or endpoint changes.

## Before pushing

The integration is committed locally, with no push performed. Review the local commit and resolve the OpenAI 429 condition before claiming a successful live-language demo. Repeat the canonical report and reset once provider access is restored. No additional local configuration is needed for the verified structured demo. Never add .env files, cache output, or credentials to the commit.
