"""Strict extraction schema: no graph IDs, routes, or assignment fields."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.incidents import IncidentPlan, IncidentRequest, IncidentType, Severity
from app.models.scenario import Latitude, Longitude


class ReportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    report: str = Field(min_length=1, max_length=8000)


class ParsedEvent(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, str_strip_whitespace=True)
    type: IncidentType
    certainty: Literal["confirmed", "uncertain"]
    evidence: str = Field(min_length=1, max_length=1000)
    road_name: str | None = Field(default=None, min_length=1, max_length=200)
    zone: str | None = Field(default=None, min_length=1, max_length=200)
    shelter: str | None = Field(default=None, min_length=1, max_length=200)
    latitude: Latitude | None = None
    longitude: Longitude | None = None
    injuries: int | None = Field(default=None, gt=0)
    severity: Severity | None = None
    reason: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def valid_fields(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Coordinates must be paired")
        count = sum([self.road_name is not None, self.zone is not None,
                     self.shelter is not None, self.latitude is not None])
        if count > 1 or (self.certainty == "confirmed" and count != 1):
            raise ValueError("Confirmed events require exactly one location reference")
        emergency = self.type in ("MEDICAL_INCIDENT", "RESCUE_INCIDENT")
        if emergency and self.road_name is not None:
            raise ValueError("Emergency events require a zone, shelter, or coordinates")
        if not emergency and (self.zone is not None or self.shelter is not None):
            raise ValueError("Road events require an identified road or coordinates")
        if self.type == "MEDICAL_INCIDENT" and self.certainty == "confirmed" and self.injuries is None:
            raise ValueError("Confirmed medical events require an explicit injury count")
        if self.type != "MEDICAL_INCIDENT" and self.injuries is not None:
            raise ValueError("Only medical events accept injuries")
        return self


class ParsedReport(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    events: list[ParsedEvent] = Field(max_length=16)
    notes: list[str] = Field(default_factory=list, max_length=16)


class ParseResponse(IncidentPlan):
    original_report: str
    parser: Literal["anthropic"] = "anthropic"
    parsed_events: list[ParsedEvent]
    applied_events: list[IncidentRequest]
    notes: list[str]
