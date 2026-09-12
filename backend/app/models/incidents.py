"""Structured incident requests and map-ready replanning responses."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.optimization import OptimizationResponse
from app.models.scenario import Latitude, Longitude
from app.models.emergency import DispatchSummary, EmergencyMetrics, ResponderRoute

IncidentType = Literal["ROAD_CLOSURE", "ROAD_REOPEN", "HAZARD_UPDATE", "ROAD_DAMAGE", "DEBRIS", "MEDICAL_INCIDENT", "RESCUE_INCIDENT"]
Severity = Literal["low", "medium", "high"]


class IncidentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    type: IncidentType
    edge_id: str | None = Field(default=None, min_length=1)
    edge_ids: list[str] | None = Field(default=None, min_length=1, max_length=5000)
    road_name: str | None = Field(default=None, min_length=1)
    latitude: Latitude | None = None
    longitude: Longitude | None = None
    severity: Severity = "high"
    zone: str | None = Field(default=None, min_length=1)
    injuries: int | None = Field(default=None, gt=0, strict=True)

    @model_validator(mode="after")
    def validate_target(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be provided together")
        if self.type in ("MEDICAL_INCIDENT", "RESCUE_INCIDENT"):
            if self.edge_id is not None or self.edge_ids is not None or self.road_name is not None:
                raise ValueError("Emergency incidents target a zone or latitude+longitude, not road edges")
            if (self.zone is not None) == (self.latitude is not None):
                raise ValueError("Emergency incidents require exactly one zone or latitude+longitude")
            if self.type == "MEDICAL_INCIDENT" and self.injuries is None:
                raise ValueError("Medical incidents require injuries")
            if self.type == "RESCUE_INCIDENT" and self.injuries is not None:
                raise ValueError("Report injuries separately as MEDICAL_INCIDENT")
            return self
        if self.zone is not None or self.injuries is not None:
            raise ValueError("zone and injuries are only supported for MEDICAL_INCIDENT")
        count = sum([self.edge_id is not None, self.edge_ids is not None,
                     self.road_name is not None, self.latitude is not None])
        if count != 1:
            raise ValueError("Provide exactly one target: edge_id, edge_ids, road_name, or latitude+longitude")
        return self


class ActiveIncident(BaseModel):
    id: str
    type: IncidentType
    severity: Severity
    affected_edge_ids: list[str]
    zone: str | None = None
    latitude: Latitude | None = None
    longitude: Longitude | None = None
    graph_node: str | None = None
    injuries: int | None = Field(default=None, gt=0)


class IncidentList(BaseModel):
    incidents: list[ActiveIncident]


class IncidentPlan(OptimizationResponse):
    incidents: list[ActiveIncident]
    ambulances: list[ResponderRoute] = Field(default_factory=list)
    rescue_teams: list[ResponderRoute] = Field(default_factory=list)
    dispatch_summary: list[DispatchSummary] = Field(default_factory=list)
    metrics: EmergencyMetrics


class IncidentResponse(IncidentPlan):
    incident: ActiveIncident
    affected_edge_ids: list[str]
