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
    simulated: Literal[True] = True


class Zone(Site):
    population: int = Field(ge=0)


class Shelter(Site):
    capacity: int = Field(ge=0)
    current_occupancy: int = Field(ge=0)


class Road(BaseModel):
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
    data_note: str = "Real OpenStreetMap roads; simulated zones, shelters, populations, capacities and occupancy."
    attribution: str = "© OpenStreetMap contributors"
    attribution_url: str = "https://www.openstreetmap.org/copyright"


class ScenarioResponse(BaseModel):
    scenario: ScenarioInfo
    zones: list[Zone]
    shelters: list[Shelter]
    roads: list[Road]
