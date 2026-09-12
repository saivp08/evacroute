"""EvacRoute road-network and demo scenario API."""

from contextlib import asynccontextmanager
from collections.abc import Callable

import networkx as nx

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.data.road_network import load_graph
from app.data.scenario import build_scenario
from app.models.scenario import ScenarioResponse

def create_app(graph_loader: Callable[[], nx.MultiDiGraph] = load_graph) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application: FastAPI):
        # One download/cache load per process, never per request. Startup fails
        # visibly if OSM is unavailable and no local cache exists.
        application.state.graph = graph_loader()
        application.state.scenario = build_scenario(application.state.graph)
        yield

    application = FastAPI(title="EvacRoute", lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    application.add_middleware(GZipMiddleware, minimum_size=1000)

    @application.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @application.get("/scenario", response_model=ScenarioResponse)
    def scenario() -> ScenarioResponse:
        return application.state.scenario

    return application


app = create_app()
