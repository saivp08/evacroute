"""Structured incident requests and map-ready replanning responses."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.optimization import OptimizationResponse
from app.models.scenario import Latitude, Longitude

IncidentType = Literal["ROAD_CLOSURE", "ROAD_REOPEN", "HAZARD_UPDATE", "ROAD_DAMAGE", "DEBRIS"]
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

    @model_validator(mode="after")
    def validate_target(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be provided together")
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


class IncidentList(BaseModel):
    incidents: list[ActiveIncident]


class IncidentPlan(OptimizationResponse):
    incidents: list[ActiveIncident]


class IncidentResponse(IncidentPlan):
    incident: ActiveIncident
    affected_edge_ids: list[str]
