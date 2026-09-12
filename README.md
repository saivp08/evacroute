# EvacRoute

EvacRoute is a planned real-time disaster transportation coordination platform for first responders and emergency management teams.

**Current status: initial project skeleton only.** The backend exposes `GET /health` returning `{"status":"ok"}` and the frontend displays a placeholder. Routing, optimization, Grok integration, data ingestion, and the map/dashboard are not implemented. No datasets are downloaded.

## Architecture

- Backend: Python + FastAPI. Planned additions: NetworkX, OSMnx, Google OR-Tools, and Grok API.
- Frontend: Next.js App Router + React + TypeScript. Leaflet or Mapbox will be selected later.
- Planned data: OpenStreetMap, FEMA National Shelter System, U.S. Census population data, and Kincade Wildfire Evacuation Traffic Dataset.

```text
Emergency reports
  -> Grok
  -> Structured incidents
  -> Dynamic transportation graph
  -> Optimization engine
  -> Evacuation + emergency response plan
  -> Interactive map/dashboard
```

Only skeleton runtime dependencies are installed. Add the planned libraries when their implementation begins.

## Repository layout

```text
EvacRoute/
|-- backend/
|   |-- app/
|   |   |-- api/
|   |   |-- data/
|   |   |-- grok/
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

- `backend/.env`: `GROK_API_KEY=` is reserved and can remain empty. Uvicorn loads this file with `--env-file .env`; no Grok calls exist yet.
- `frontend/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:8000` is the URL future frontend requests should use via `process.env.NEXT_PUBLIC_API_URL`. The placeholder page does not make API requests.
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
- `backend-dev`: Developer 1 owns backend, optimization, routing, ingestion, and Grok.
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
