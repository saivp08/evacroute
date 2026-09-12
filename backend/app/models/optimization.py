"""Public evacuation plan and structured infeasibility response."""

from pydantic import BaseModel, Field

from app.models.scenario import Coordinate


class EvacuationRoute(BaseModel):
    id: str
    zone: str
    zone_name: str
    shelter: str
    shelter_name: str
    people: int = Field(gt=0)
    travel_time_s: float = Field(ge=0)
    effective_travel_time_s: float = Field(ge=0)
    distance_m: float = Field(ge=0)
    coordinates: list[Coordinate] = Field(min_length=2)
    nodes: list[str]
    edge_ids: list[str]


class ShelterAssignment(BaseModel):
    shelter: str
    shelter_name: str
    assigned_people: int = Field(ge=0)
    remaining_capacity_after_assignment: int = Field(ge=0)


class OptimizationMetrics(BaseModel):
    total_evacuees: int = Field(ge=0)
    assigned_evacuees: int = Field(ge=0)
    total_available_shelter_capacity: int = Field(ge=0)
    average_travel_time_s: float = Field(ge=0)
    total_person_travel_time_s: float = Field(ge=0)
    average_effective_travel_time_s: float = Field(ge=0)
    total_person_effective_travel_time_s: float = Field(ge=0)


class OptimizationResponse(BaseModel):
    evacuation_routes: list[EvacuationRoute]
    shelter_assignments: list[ShelterAssignment]
    metrics: OptimizationMetrics


class OptimizationError(BaseModel):
    code: str
    message: str
    total_evacuees: int
    total_available_shelter_capacity: int


class OptimizationErrorResponse(BaseModel):
    detail: OptimizationError
