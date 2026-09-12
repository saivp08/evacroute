"""In-memory incident overlay. Base OSM data and cache files are never written."""

from hashlib import sha256
from threading import RLock

import networkx as nx
from pyproj import Transformer
from shapely.geometry import LineString, Point
from shapely.ops import transform

from app.models.incidents import ActiveIncident, IncidentRequest


class TargetNotFound(ValueError):
    pass


def resolve_target(graph: nx.MultiDiGraph, request: IncidentRequest) -> list[str]:
    edges = {f"{u}:{v}:{k}": (u, v, k, data)
             for u, v, k, data in graph.edges(keys=True, data=True)}
    if request.edge_id is not None or request.edge_ids is not None:
        selected = sorted(set(request.edge_ids or [request.edge_id]))
        missing = [edge for edge in selected if edge not in edges]
        if missing:
            raise TargetNotFound(f"Unknown edge IDs: {', '.join(missing[:10])}")
        return selected
    if request.road_name is not None:
        # Exact case-insensitive matching; every occurrence/segment is included.
        name = request.road_name.casefold()
        selected = []
        for id_, (_, _, _, data) in edges.items():
            names = data.get("name", [])
            if not isinstance(names, list):
                names = [names]
            if any(str(item).strip().casefold() == name for item in names):
                selected.append(id_)
        if not selected:
            raise TargetNotFound(f"No road named {request.road_name!r}; use a name from GET /scenario")
        return sorted(selected)
    # Metric nearest-edge lookup in Santa Rosa's UTM zone. No spatial-index
    # dependency needed for this small graph. Tie-break by directed edge ID.
    project = Transformer.from_crs("EPSG:4326", "EPSG:32610", always_xy=True).transform
    point = transform(project, Point(request.longitude, request.latitude))
    candidates = []
    for id_, (u, v, _, data) in edges.items():
        line = data.get("geometry")
        if line is None:
            line = LineString([(graph.nodes[n]["x"], graph.nodes[n]["y"]) for n in (u, v)])
        candidates.append((point.distance(transform(project, line)), id_))
    if not candidates or min(candidates)[0] > 150:
        raise TargetNotFound("No road edge within 150 meters of the supplied coordinates")
    return [min(candidates)[1]]


class IncidentState:
    def __init__(self):
        self.lock = RLock()
        self.active: list[ActiveIncident] = []

    def propose(self, graph: nx.MultiDiGraph, request: IncidentRequest):
        affected = resolve_target(graph, request)
        token = f"{request.type}|{request.severity}|{'|'.join(affected)}"
        incident = ActiveIncident(id="incident-" + sha256(token.encode()).hexdigest()[:16],
                                  type=request.type, severity=request.severity,
                                  affected_edge_ids=affected)
        affected_set = set(affected)
        updated = []
        for existing in self.active:
            # Last update wins per edge and incident type. Reopen clears closure
            # and blocking debris, preserving hazards, damage, and mild debris.
            replace = existing.type == request.type or (
                request.type == "ROAD_REOPEN" and (
                    existing.type == "ROAD_CLOSURE" or
                    (existing.type == "DEBRIS" and existing.severity == "high")
                )
            )
            remaining = [e for e in existing.affected_edge_ids if not replace or e not in affected_set]
            if remaining:
                updated.append(existing.model_copy(update={"affected_edge_ids": remaining}))
        if request.type != "ROAD_REOPEN":
            updated.append(incident)
        return incident, sorted(updated, key=lambda item: item.id)


def derive_graph(base: nx.MultiDiGraph, incidents: list[ActiveIncident]) -> nx.MultiDiGraph:
    graph = base.copy()
    for _, _, _, edge in graph.edges(keys=True, data=True):
        edge.update(blocked=False, hazard_risk=0.0, damage_penalty=1.0, debris_penalty=1.0,
                    effective_travel_time=float(edge["travel_time"]))
    for incident in incidents:
        for edge_id in incident.affected_edge_ids:
            u, v, k = map(int, edge_id.split(":"))
            edge = graph[u][v][k]
            if incident.type == "ROAD_CLOSURE":
                edge["blocked"] = True
            elif incident.type == "HAZARD_UPDATE":
                edge["hazard_risk"] = {"low": 0.25, "medium": 0.5, "high": 1.0}[incident.severity]
            elif incident.type == "ROAD_DAMAGE":
                edge["damage_penalty"] = {"low": 1.5, "medium": 2.0, "high": 4.0}[incident.severity]
            elif incident.type == "DEBRIS":
                edge["debris_penalty"] = {"low": 2.0, "medium": 5.0, "high": 1.0}[incident.severity]
                if incident.severity == "high":
                    edge["blocked"] = True
    for _, _, _, edge in graph.edges(keys=True, data=True):
        edge["effective_travel_time"] = (
            edge["travel_time"] * (1 + 4 * edge["hazard_risk"])
            * edge["damage_penalty"] * edge["debris_penalty"]
        )
    return graph
