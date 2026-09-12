"""Demo locations are illustrative points, not official shelters or zones."""

import networkx as nx
import osmnx as ox

from app.models.scenario import EmergencyResource, Road, ScenarioInfo, ScenarioResponse, Shelter, Zone

ZONE_SPECS = [
    ("zone-a", "Zone A — Northwest demo", 38.4500, -122.7300, 600),
    ("zone-b", "Zone B — Northeast demo", 38.4530, -122.7000, 850),
    ("zone-c", "Zone C — Southeast demo", 38.4300, -122.6990, 550),
]
SHELTER_SPECS = [
    ("shelter-a", "Shelter A — Southwest demo", 38.4270, -122.7310, 1000, 100),
    ("shelter-b", "Shelter B — Central demo", 38.4380, -122.7160, 900, 100),
    ("shelter-c", "Shelter C — East demo", 38.4430, -122.6930, 800, 100),
]

# Illustrative staging points, not claims about real EMS bases or availability.
RESOURCE_SPECS = [
    ("ambulance-1", "ambulance", "Ambulance 1 — Central staging", 38.4380, -122.7160, 4),
    ("ambulance-2", "ambulance", "Ambulance 2 — East staging", 38.4430, -122.6930, 4),
    ("ambulance-3", "ambulance", "Ambulance 3 — Southwest staging", 38.4270, -122.7310, 4),
    ("ambulance-4", "ambulance", "Ambulance 4 — Northwest staging", 38.4500, -122.7300, 4),
    ("rescue-team-1", "rescue_team", "Rescue team 1 — Central staging", 38.4380, -122.7160, 1),
    ("rescue-team-2", "rescue_team", "Rescue team 2 — East staging", 38.4430, -122.6930, 1),
]


def nearest_node(graph: nx.MultiDiGraph, latitude: float, longitude: float) -> int:
    # A few points on a small graph: exhaustive great-circle lookup avoids adding
    # scikit-learn solely for an optional spatial index. Tie-break by OSM ID.
    return min(graph.nodes, key=lambda node: (
        float(ox.distance.great_circle(latitude, longitude,
                                      graph.nodes[node]["y"], graph.nodes[node]["x"])),
        node,
    ))


def label(value: object, fallback: str) -> str:
    if isinstance(value, list):
        return "; ".join(sorted({str(item) for item in value})) or fallback
    return str(value) if value else fallback


def build_scenario(graph: nx.MultiDiGraph, *, use_public_data: bool = True) -> ScenarioResponse:
    zones = [Zone(id=id_, name=name, latitude=lat, longitude=lon,
                  graph_node=str(nearest_node(graph, lat, lon)), population=population)
             for id_, name, lat, lon, population in ZONE_SPECS]
    shelters = [Shelter(id=id_, name=name, latitude=lat, longitude=lon,
                        graph_node=str(nearest_node(graph, lat, lon)),
                        capacity=capacity, current_occupancy=occupancy)
                for id_, name, lat, lon, capacity, occupancy in SHELTER_SPECS]
    roads = []
    for source, target, key, edge in sorted(graph.edges(keys=True, data=True)):
        geometry = edge.get("geometry")
        coordinates = ([(round(y, 6), round(x, 6)) for x, y in geometry.coords]
                       if geometry is not None else
                       [(round(graph.nodes[n]["y"], 6), round(graph.nodes[n]["x"], 6))
                        for n in (source, target)])
        roads.append(Road(
            id=edge["edge_id"], source=str(source), target=str(target),
            name=label(edge.get("name"), "Unnamed road"),
            road_type=label(edge.get("highway"), "unknown"),
            length_m=round(edge["length"], 2), speed_kph=round(edge["speed_kph"], 2),
            travel_time_s=round(edge["travel_time"], 2), coordinates=coordinates,
        ))
    scenario = ScenarioResponse(
        scenario=ScenarioInfo(node_count=len(graph), edge_count=graph.number_of_edges()),
        zones=zones, shelters=shelters, roads=roads,
        emergency_resources=[EmergencyResource(
            id=id_, type=kind, name=name, latitude=lat, longitude=lon,
            graph_node=str(nearest_node(graph, lat, lon)), response_capacity=capacity,
        ) for id_, kind, name, lat, lon, capacity in RESOURCE_SPECS],
    )
    if use_public_data:
        from app.data.public_data import use_processed_data
        return use_processed_data(scenario, graph)
    return scenario
