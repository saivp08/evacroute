"""Directed travel-time paths with consistent parallel-edge geometry and totals."""

from dataclasses import dataclass

import networkx as nx

from app.models.scenario import Coordinate, Shelter, Zone


@dataclass
class RoadPath:
    nodes: list[str]
    edge_ids: list[str]
    travel_time_s: float
    distance_m: float
    coordinates: list[Coordinate]


def compute_shortest_paths(
    graph: nx.MultiDiGraph, zones: list[Zone], shelters: list[Shelter]
) -> dict[tuple[str, str], RoadPath]:
    # Collapse parallel edges by minimum travel time, retaining the exact edge.
    # Sorted insertion and edge-key tie breaks make equal-cost paths repeatable.
    routing_graph = nx.DiGraph()
    routing_graph.add_nodes_from(sorted(graph.nodes))
    for source, target, key, edge in sorted(graph.edges(keys=True, data=True)):
        existing = routing_graph.get_edge_data(source, target)
        if existing is None or edge["travel_time"] < existing["travel_time"]:
            routing_graph.add_edge(source, target, travel_time=edge["travel_time"], key=key)

    paths = {}
    for zone in sorted(zones, key=lambda item: item.id):
        _, node_paths = nx.single_source_dijkstra(
            routing_graph, int(zone.graph_node), weight="travel_time"
        )
        for shelter in sorted(shelters, key=lambda item: item.id):
            nodes = node_paths.get(int(shelter.graph_node))
            if nodes is None:
                continue  # Unreachable pairs must not become assignment arcs.
            coordinates = []
            edge_ids = []
            seconds = distance = 0.0
            for source, target in zip(nodes, nodes[1:]):
                key = routing_graph[source][target]["key"]
                edge = graph[source][target][key]
                start = (graph.nodes[source]["y"], graph.nodes[source]["x"])
                end = (graph.nodes[target]["y"], graph.nodes[target]["x"])
                geometry = edge.get("geometry")
                points = [(y, x) for x, y in geometry.coords] if geometry is not None else [start, end]
                # OSM geometry can be stored in the opposite direction.
                if sum((points[-1][i] - start[i]) ** 2 for i in (0, 1)) < sum(
                    (points[0][i] - start[i]) ** 2 for i in (0, 1)
                ):
                    points.reverse()
                points[0], points[-1] = start, end
                coordinates.extend(points if not coordinates else points[1:])
                edge_ids.append(f"{source}:{target}:{key}")
                seconds += float(edge["travel_time"])
                distance += float(edge["length"])
            if not coordinates:
                # Co-located sites require no travel; keep a valid two-point line.
                node = graph.nodes[nodes[0]]
                coordinates = [(node["y"], node["x"])] * 2
            paths[zone.id, shelter.id] = RoadPath(
                nodes=[str(node) for node in nodes], edge_ids=edge_ids,
                travel_time_s=round(seconds, 3), distance_m=round(distance, 3),
                coordinates=[(round(lat, 6), round(lon, 6)) for lat, lon in coordinates],
            )
    return paths
