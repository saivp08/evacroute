"""Public map contract. Coordinate pairs are always [latitude, longitude]."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field

Latitude = Annotated[float, Field(ge=-90, le=90)]
Longitude = Annotated[float, Field(ge=-180, le=180)]
Coordinate = tuple[Latitude, Longitude]


class Site(BaseModel):
    id: str
    name: str
    latitude: Latitude
    longitude: Longitude
    graph_node: str
    simulated: bool = True
    data_source: str = "EvacRoute demo fallback"
    source_id: str | None = None
    retrieved_at: str | None = None
    field_sources: dict[str, str] = Field(default_factory=dict)


class Zone(Site):
    population: int = Field(ge=0)
    original_population: int | None = Field(default=None, ge=0)
    population_scale_factor: float = Field(default=1, ge=0)
    population_is_scaled: bool = False
    geography: str | None = None
    boundary: list[list[Coordinate]] = Field(default_factory=list)


class Shelter(Site):
    capacity: int = Field(ge=0)
    current_occupancy: int = Field(ge=0)
    status: str = "DEMO_AVAILABLE"
    planning_available: bool = True
    address: str | None = None
    evacuation_capacity: int | None = Field(default=None, ge=0)
    post_impact_capacity: int | None = Field(default=None, ge=0)
    current_occupancy_is_assumed: bool = False

    @property
    def available_capacity(self) -> int:
        return max(0, self.capacity - self.current_occupancy) if self.planning_available else 0


class EmergencyResource(Site):
    type: Literal["ambulance", "rescue_team"]
    availability_status: Literal["available", "unavailable"] = "available"
    response_capacity: int = Field(gt=0)


class Road(BaseModel):
    simulated: Literal[False] = False
    data_source: str = "OpenStreetMap"
    id: str
    source: str
    target: str
    name: str
    road_type: str
    length_m: float = Field(ge=0)
    speed_kph: float = Field(gt=0)
    travel_time_s: float = Field(ge=0)
    coordinates: list[Coordinate] = Field(min_length=2)


class ScenarioInfo(BaseModel):
    name: str = "Santa Rosa wildfire demo"
    location: str = "Santa Rosa, California, USA"
    status: Literal["ready"] = "ready"
    center: Coordinate = (38.4404, -122.7141)
    extent_m: int = 2500
    node_count: int
    edge_count: int
    coordinate_order: str = "latitude, longitude"
    data_note: str = "Real OpenStreetMap roads; simulated zones, shelters, populations, capacities, occupancy and emergency resources."
    attribution: str = "© OpenStreetMap contributors"
    attribution_url: str = "https://www.openstreetmap.org/copyright"
    data_mode: str = "demo_fallback"
    public_data_metadata: dict = Field(default_factory=dict)


class ScenarioResponse(BaseModel):
    scenario: ScenarioInfo
    zones: list[Zone]
    shelters: list[Shelter]
    roads: list[Road]
    emergency_resources: list[EmergencyResource] = Field(default_factory=list)
