"""Structured output contract for incident-photo analysis (POST /incident/analyze-image).

Mirrors the strictness of app/openai/schemas.py: every field the model can leave unknown is
nullable, and nothing here claims to be geographic truth — the frontend keeps its own
independent "Pick on Map" location control (see backend/app/vision/README note in
main.py's endpoint docstring)."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

IncidentTypeLabel = Literal[
    "FIRE", "FLOOD", "ROAD_CLOSURE", "CRASH", "MEDICAL_EMERGENCY", "WILDFIRE", "HAZARDOUS_MATERIAL", "OTHER"
]
SeverityLabel = Literal["LOW", "MODERATE", "HIGH", "CRITICAL"]


class ImageAnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    # Base64-encoded image bytes (no data: URL prefix) and its real MIME type, plus optional
    # free text the user already typed (e.g. "This is from Fourth Street") for extra context.
    image_base64: str = Field(min_length=1)
    mime_type: Literal["image/jpeg", "image/png", "image/webp"]
    context_text: str | None = Field(default=None, max_length=2000)


class ConfidenceScores(BaseModel):
    model_config = ConfigDict(extra="forbid")
    incident_type: float = Field(ge=0, le=1)
    severity: float = Field(ge=0, le=1)


class ImageAnalysisResult(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    incident_type: IncidentTypeLabel
    severity: SeverityLabel | None = None
    description: str = Field(min_length=1, max_length=1000)
    affected_road: str | None = Field(default=None, max_length=200)
    estimated_people_affected: int | None = Field(default=None, gt=0)
    environmental_conditions: list[str] = Field(default_factory=list, max_length=10)
    confidence: ConfidenceScores
