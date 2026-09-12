"""EvacRoute road-network and demo scenario API."""

from contextlib import asynccontextmanager
from collections.abc import Callable

import networkx as nx

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.data.road_network import load_graph
from app.data.scenario import build_scenario
from app.models.scenario import ScenarioResponse
from app.models.optimization import OptimizationErrorResponse, OptimizationResponse
from app.optimization.evacuation import InfeasiblePlan, optimize_evacuation
from app.data.incidents import IncidentState, TargetNotFound, derive_graph
from app.models.incidents import IncidentList, IncidentPlan, IncidentRequest, IncidentResponse

def create_app(graph_loader: Callable[[], nx.MultiDiGraph] = load_graph) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application: FastAPI):
        # One download/cache load per process, never per request. Startup fails
        # visibly if OSM is unavailable and no local cache exists.
        application.state.graph = graph_loader()
        application.state.scenario = build_scenario(application.state.graph)
        application.state.incidents = IncidentState()
        yield

    application = FastAPI(title="EvacRoute", lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    application.add_middleware(GZipMiddleware, minimum_size=1000)

    @application.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @application.get("/scenario", response_model=ScenarioResponse)
    def scenario() -> ScenarioResponse:
        return application.state.scenario

    @application.post("/optimize", response_model=OptimizationResponse,
                      responses={409: {"model": OptimizationErrorResponse}})
    def optimize() -> OptimizationResponse:
        try:
            state = application.state.incidents
            with state.lock:
                return optimize_evacuation(derive_graph(application.state.graph, state.active),
                                           application.state.scenario)
        except InfeasiblePlan as error:
            raise HTTPException(status_code=409, detail=error.detail.model_dump()) from error

    @application.get("/incidents", response_model=IncidentList)
    def incidents() -> IncidentList:
        state = application.state.incidents
        with state.lock:
            return IncidentList(incidents=list(state.active))

    @application.post("/incident", response_model=IncidentResponse)
    def apply_incident(request: IncidentRequest) -> IncidentResponse:
        state = application.state.incidents
        with state.lock:
            try:
                incident, candidate = state.propose(application.state.graph, request)
                plan = optimize_evacuation(derive_graph(application.state.graph, candidate),
                                           application.state.scenario)
            except TargetNotFound as error:
                raise HTTPException(404, detail={"code": "road_target_not_found", "message": str(error)}) from error
            except InfeasiblePlan as error:
                # Atomic application: a rejected update leaves the current state intact.
                raise HTTPException(409, detail={**error.detail.model_dump(), "incident_applied": False}) from error
            state.active = candidate
            return IncidentResponse(**plan.model_dump(), incident=incident,
                                    affected_edge_ids=incident.affected_edge_ids, incidents=candidate)

    @application.post("/incidents/reset", response_model=IncidentPlan)
    def reset_incidents() -> IncidentPlan:
        state = application.state.incidents
        with state.lock:
            try:
                plan = optimize_evacuation(application.state.graph, application.state.scenario)
            except InfeasiblePlan as error:
                raise HTTPException(409, detail=error.detail.model_dump()) from error
            state.active = []
            return IncidentPlan(**plan.model_dump(), incidents=[])

    return application


app = create_app()
