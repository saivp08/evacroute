# EvacRoute

EvacRoute is a planned real-time disaster transportation coordination platform for first responders and emergency management teams.

**Current status:** The backend supports routing, optimization, structured incidents, cached public data, and OpenAI report parsing. The frontend overview connects to the real API. See [integration setup, demo, and validation](INTEGRATION.md), [backend setup](backend/README.md), and the [API contract](backend/API.md).

## Architecture

- Backend: Python + FastAPI, NetworkX, OSMnx, Google OR-Tools, and OpenAI API.
- Frontend: Next.js App Router + React + TypeScript + Leaflet.
- Planned data: OpenStreetMap, FEMA National Shelter System, U.S. Census population data, and Kincade Wildfire Evacuation Traffic Dataset.

```text
Emergency reports
  -> OpenAI
  -> Structured incidents
  -> Dynamic transportation graph
  -> Optimization engine
  -> Evacuation + emergency response plan
  -> Interactive map/dashboard
```

Runtime dependencies are declared in the backend requirements and frontend package files.

## Repository layout

```text
EvacRoute/
|-- backend/
|   |-- app/
|   |   |-- api/
|   |   |-- data/
|   |   |-- openai/
|   |   |-- models/
|   |   |-- optimization/
|   |   |-- routing/
|   |   |-- __init__.py
|   |   `-- main.py
|   |-- tests/
|   |-- .env.example
|   `-- requirements.txt
|-- frontend/
|   |-- app/ (layout.tsx, page.tsx, globals.css)
|   |-- components/
|   |-- lib/
|   |-- public/
|   |-- .env.local.example
|   |-- AGENTS.md / CLAUDE.md (generated Next.js agent guidance)
|   |-- package.json
|   |-- package-lock.json
|   `-- tsconfig.json
|-- datasets/
|   |-- raw/
|   `-- processed/
|-- docs/
|-- .gitignore
|-- LICENSE
`-- README.md
```

Empty directories contain `.gitkeep`. Virtual environments, downloaded raw data, credentials, and build outputs are ignored. Small processed/demo datasets may be intentionally committed. Put downloads in `datasets/raw/`.

## Local setup

Prerequisites: Git, Python 3.11+ (3.12 recommended for future geospatial dependencies), and Node.js 22+ with npm. Use two terminals to run both services. Commands below use Windows PowerShell and avoid activation/execution-policy issues.

### Developer 1: backend

Replace `<repository-url>` with the shared GitHub repository URL:

```powershell
git clone <repository-url> EvacRoute
cd EvacRoute
git switch backend-dev
git pull --ff-only origin backend-dev
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --env-file .env
```

Backend: http://localhost:8000/health; API docs: http://localhost:8000/docs.

### Developer 2: frontend

```powershell
git clone <repository-url> EvacRoute
cd EvacRoute
git switch frontend-dev
git pull --ff-only origin frontend-dev
cd frontend
Copy-Item .env.local.example .env.local
npm.cmd ci
npm.cmd run dev
```

Frontend: http://localhost:3000. Either developer can run the other service by opening another terminal in the same clone and following that service's setup commands, without switching branches.

On macOS/Linux, use `python3`, `.venv/bin/python`, `cp`, and `npm` instead of `python`, `.\.venv\Scripts\python.exe`, `Copy-Item`, and `npm.cmd`.

### Environment and local communication

- `backend/.env`: `OPEN_AI_API_KEY=` enables natural-language parsing. Uvicorn loads this file with `--env-file .env`; structured endpoints work without a key. Optional settings are `OPEN_AI_MODEL` (default `gpt-4.1-mini`), `OPEN_AI_BASE_URL`, and `OPEN_AI_TIMEOUT_SECONDS`.
- `frontend/.env.local`: `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000` configures the live API service. Initial load fetches the scenario and current optimization plan.
- FastAPI permits browser requests from `http://localhost:3000` and `http://127.0.0.1:3000` using CORS. If ports change, update the URL and allowed origins together.
- Restart the frontend after changing its environment. Never put secrets in `NEXT_PUBLIC_` variables or commit real keys.

### Checks

With the backend running, in another PowerShell terminal:

```powershell
Invoke-RestMethod http://localhost:8000/health
```

Expected: `status` is `ok`. From `frontend/`:

```powershell
npm.cmd run build
npm.cmd run typecheck
```

Stop development servers with Ctrl+C before building. `npm.cmd start` serves the production build on port 3000.

Initial setup verified on Windows with Python 3.14.6 and Node.js 22.19.0: backend startup, health response, local CORS header, Python dependency consistency, frontend startup/HTTP response, production build, and TypeScript check all passed. Next.js may report that an unrelated ancestor lockfile is ignored; this does not affect the project build.

## Two-developer workflow

- `main`: shared working skeleton and merged work.
- `backend-dev`: Developer 1 owns backend, optimization, routing, ingestion, and OpenAI.
- `frontend-dev`: Developer 2 owns frontend, map, dashboard, routes, and incident visualization.

Before starting work, switch to your branch and run `git pull --ff-only origin <your-branch>`. If the branch has not yet been published, create it from main with `git switch -c backend-dev main` or `git switch -c frontend-dev main`, then `git push -u origin <your-branch>`.

Commit small changes frequently, stage explicit paths, and push your branch:

```powershell
git add backend/
git commit -m "Describe the backend change"
git push -u origin backend-dev
```

Developer 2 substitutes `frontend/` and `frontend-dev`. Open pull requests into `main` and have the other developer review. After changes merge, bring main into your branch with `git fetch origin` and `git merge origin/main`, resolve any conflicts, and push. Coordinate edits to README, shared docs, and future API contracts; keep dependency updates within your owned directory. Do not commit environments or generated files.

### Publish the initial repository once

The local setup cannot know your GitHub repository URL. Create an empty GitHub repository (without generated files), then run from the repository root:

```powershell
git remote add origin <repository-url>
git push -u origin main
git push -u origin backend-dev
git push -u origin frontend-dev
```

## License

MIT; see [LICENSE](LICENSE).

## Setup references

[Next.js installation](https://nextjs.org/docs/app/getting-started/installation) and [FastAPI CORS](https://fastapi.tiangolo.com/tutorial/cors/).
