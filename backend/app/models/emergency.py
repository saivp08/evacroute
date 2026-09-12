"""Responder route, coverage, and combined-plan metrics."""

from typing import Literal

from pydantic import BaseModel, Field

from app.models.optimization import OptimizationMetrics
from app.models.scenario import Coordinate


class ResponderRoute(BaseModel):
    id: str
    name: str
    type: Literal["ambulance", "rescue_team"]
    destination: str
    incident_id: str
    travel_time_s: float = Field(ge=0)
    effective_travel_time_s: float = Field(ge=0)
    distance_m: float = Field(ge=0)
    coordinates: list[Coordinate] = Field(min_length=2)
    nodes: list[str]
    edge_ids: list[str]
    response_capacity: int = Field(gt=0)
    simulated: Literal[True] = True


class DispatchSummary(BaseModel):
    incident_id: str
    injuries: int = Field(ge=0)
    supported_injuries: int = Field(ge=0)
    uncovered_injuries: int = Field(ge=0)
    ambulances_dispatched: int = Field(ge=0)
    rescue_teams_required: int = Field(ge=0)
    rescue_teams_dispatched: int = Field(ge=0)
    unfilled_rescue_requests: int = Field(ge=0)
    status: Literal["covered", "partial", "unserved"]


class EmergencyMetrics(OptimizationMetrics):
    active_medical_incidents: int = Field(default=0, ge=0)
    active_rescue_incidents: int = Field(default=0, ge=0)
    ambulances_dispatched: int = Field(default=0, ge=0)
    rescue_teams_dispatched: int = Field(default=0, ge=0)
    average_emergency_response_time_s: float = Field(default=0, ge=0)
    maximum_emergency_response_time_s: float = Field(default=0, ge=0)
    average_effective_emergency_response_time_s: float = Field(default=0, ge=0)
    uncovered_injuries: int = Field(default=0, ge=0)
    unfilled_rescue_requests: int = Field(default=0, ge=0)
