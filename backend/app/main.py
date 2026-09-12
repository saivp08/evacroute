"""EvacRoute road-network and demo scenario API."""

from contextlib import asynccontextmanager
from collections.abc import Callable
import logging
from time import perf_counter

import networkx as nx

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.data.road_network import load_graph
from app.data.scenario import build_scenario
from app.models.scenario import ScenarioResponse
from app.models.errors import ErrorResponse
from app.optimization.evacuation import InfeasiblePlan
from app.data.incidents import IncidentState, TargetNotFound, derive_graph
from app.models.incidents import IncidentList, IncidentPlan, IncidentRequest, IncidentResponse
from app.optimization.dispatch import plan_transportation
from app.optimization.planning import apply_incidents, resolve_incident, IncidentNotFound
from app.openai.client import OpenAIClient, OpenAIError
from app.openai.schemas import ParseResponse, ReportRequest
from app.openai.service import parse_and_apply
from app.assistant.client import AssistantError, GrokClient
from app.assistant.schemas import AssistantChatRequest, AssistantChatResponse
from app.assistant.service import ask_assistant
from app.vision.client import GeminiClient, VisionError
from app.vision.schemas import ImageAnalysisRequest, ImageAnalysisResult

logger = logging.getLogger("uvicorn.error")

def create_app(graph_loader: Callable[[], nx.MultiDiGraph] = load_graph,
               openai_client: OpenAIClient | None = None,
               grok_client: GrokClient | None = None,
               gemini_client: GeminiClient | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application: FastAPI):
        app_logger = logging.getLogger("app")
        app_logger.setLevel(logging.INFO)
        if not app_logger.handlers:
            app_logger.handlers = (logger.handlers or logging.getLogger("uvicorn").handlers)[:]
        logger.info("Starting EvacRoute")
        # One download/cache load per process, never per request. Startup fails
        # visibly if OSM is unavailable and no local cache exists.
        application.state.graph = graph_loader()
        application.state.scenario = build_scenario(application.state.graph)
        application.state.incidents = IncidentState()
        application.state.openai = openai_client if openai_client is not None else OpenAIClient()
        application.state.grok = grok_client if grok_client is not None else GrokClient()
        application.state.gemini = gemini_client if gemini_client is not None else GeminiClient()
        info = application.state.scenario.scenario
        logger.info("Scenario loaded: mode=%s nodes=%d edges=%d zones=%d shelters=%d",
                    info.data_mode, info.node_count, info.edge_count,
                    len(application.state.scenario.zones), len(application.state.scenario.shelters))
        yield

    application = FastAPI(title="EvacRoute", lifespan=lifespan,
                          responses={status: {"model": ErrorResponse} for status in (404, 409, 422, 500, 502, 503, 504)})
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    application.add_middleware(GZipMiddleware, minimum_size=1000)

    @application.exception_handler(StarletteHTTPException)
    async def http_error(request, error):
        detail = error.detail
        normalized = detail if isinstance(detail, dict) else {"code": "http_error", "message": str(detail)}
        return JSONResponse(status_code=error.status_code,
                            content={"error": normalized, "detail": detail}, headers=error.headers)

    @application.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        # Do not echo report text, arbitrary input, or exception objects.
        issues = [{"loc": list(item["loc"]), "msg": item["msg"], "type": item["type"]}
                  for item in error.errors()]
        return JSONResponse(status_code=422, content={
            "error": {"code": "validation_error", "message": "Invalid request fields.", "fields": issues},
            "detail": issues})

    @application.middleware("http")
    async def request_log(request, call_next):
        started = perf_counter()
        try:
            response = await call_next(request)
        except Exception as error:
            logger.error("Request failed: %s %s (%s)", request.method, request.url.path, type(error).__name__)
            detail = {"code": "internal_error", "message": "Unable to complete the request."}
            response = JSONResponse(status_code=500, content={"error": detail, "detail": detail})
            origin = request.headers.get("origin")
            if origin in ("http://localhost:3000", "http://127.0.0.1:3000"):
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Vary"] = "Origin"
        elapsed = (perf_counter() - started) * 1000
        response.headers["Server-Timing"] = f"app;dur={elapsed:.1f}"
        logger.info("%s %s status=%d elapsed_ms=%.1f", request.method, request.url.path, response.status_code, elapsed)
        return response

    @application.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @application.get("/scenario", response_model=ScenarioResponse)
    def scenario() -> ScenarioResponse:
        return application.state.scenario

    @application.post("/optimize", response_model=IncidentPlan)
    def optimize() -> IncidentPlan:
        try:
            state = application.state.incidents
            with state.lock:
                return plan_transportation(derive_graph(application.state.graph, state.active),
                                           application.state.scenario, state.active)
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
                normalized, plan = apply_incidents(application.state.graph, application.state.scenario, state, [request])
                incident = normalized[0]
            except TargetNotFound as error:
                code = "incident_location_not_found" if request.type in ("MEDICAL_INCIDENT", "RESCUE_INCIDENT") else "road_target_not_found"
                raise HTTPException(404, detail={"code": code, "message": str(error)}) from error
            except InfeasiblePlan as error:
                # Atomic application: a rejected update leaves the current state intact.
                raise HTTPException(409, detail={**error.detail.model_dump(), "incident_applied": False}) from error
            return IncidentResponse(**plan.model_dump(), incident=incident,
                                    affected_edge_ids=incident.affected_edge_ids)

    @application.post("/incident/parse", response_model=ParseResponse)
    def parse_incident(request: ReportRequest) -> ParseResponse:
        try:
            return parse_and_apply(request.report, application.state.graph, application.state.scenario,
                                   application.state.incidents, application.state.openai)
        except OpenAIError as error:
            raise HTTPException(error.status, detail={"code": error.code, "message": error.message,
                                                     "incidents_applied": False}) from error
        except TargetNotFound as error:
            raise HTTPException(422, detail={"code": "unresolved_report_location", "message": str(error),
                                            "incidents_applied": False}) from error
        except InfeasiblePlan as error:
            raise HTTPException(409, detail={**error.detail.model_dump(), "incidents_applied": False}) from error

    @application.post("/assistant/chat", response_model=AssistantChatResponse)
    def assistant_chat(request: AssistantChatRequest) -> AssistantChatResponse:
        try:
            state = application.state.incidents
            with state.lock:
                plan = plan_transportation(derive_graph(application.state.graph, state.active),
                                           application.state.scenario, state.active)
            return ask_assistant(request.message, request.history, application.state.scenario,
                                 plan, application.state.grok)
        except AssistantError as error:
            raise HTTPException(error.status, detail={"code": error.code, "message": error.message}) from error
        except InfeasiblePlan as error:
            raise HTTPException(409, detail=error.detail.model_dump()) from error

    @application.post("/incident/analyze-image", response_model=ImageAnalysisResult)
    def analyze_incident_image(request: ImageAnalysisRequest) -> ImageAnalysisResult:
        # Pure analysis — does not touch incident/scenario state. The Report Incident form
        # uses this only to prefill fields the user still reviews and submits themselves
        # through the existing POST /incident/parse flow.
        try:
            return application.state.gemini.analyze(request.image_base64, request.mime_type, request.context_text)
        except VisionError as error:
            raise HTTPException(error.status, detail={"code": error.code, "message": error.message}) from error

    @application.post("/incidents/reset", response_model=IncidentPlan)
    def reset_incidents() -> IncidentPlan:
        state = application.state.incidents
        with state.lock:
            try:
                plan = plan_transportation(application.state.graph, application.state.scenario, [])
            except InfeasiblePlan as error:
                raise HTTPException(409, detail=error.detail.model_dump()) from error
            state.active = []
            return plan

    @application.post("/incident/{incident_id}/resolve", response_model=IncidentPlan)
    def resolve_one_incident(incident_id: str) -> IncidentPlan:
        state = application.state.incidents
        try:
            return resolve_incident(application.state.graph, application.state.scenario, state, incident_id)
        except IncidentNotFound as error:
            raise HTTPException(404, detail={"code": "incident_not_found", "message": str(error)}) from error
        except InfeasiblePlan as error:
            raise HTTPException(409, detail=error.detail.model_dump()) from error

    return application


app = create_app()
