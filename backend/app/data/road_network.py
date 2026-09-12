"""Download a bounded driving network once and reuse its local GraphML cache."""

import logging
from pathlib import Path

import networkx as nx
import osmnx as ox

CENTER = (38.4404, -122.7141)
DISTANCE_M = 2500  # Bounding box: approximately 5 km by 5 km.
CACHE_DIR = Path(__file__).resolve().parents[2] / "cache"
GRAPH_PATH = CACHE_DIR / "santa_rosa_drive_2500m_v1.graphml"
SPEEDS_KPH = {
    "motorway": 100, "motorway_link": 50, "trunk": 80, "trunk_link": 40,
    "primary": 50, "primary_link": 40, "secondary": 40,
    "secondary_link": 30, "tertiary": 35, "tertiary_link": 30,
    "residential": 30, "living_street": 15, "service": 20, "unclassified": 30,
}
logger = logging.getLogger(__name__)


def prepare_graph(graph: nx.MultiDiGraph) -> nx.MultiDiGraph:
    if not graph.nodes or not graph.edges:
        raise ValueError("The road network is empty")
    # OSMnx handles tagged mph speeds and imputes missing speeds by road class.
    graph = ox.routing.add_edge_speeds(graph, hwy_speeds=SPEEDS_KPH, fallback=30)
    graph = ox.routing.add_edge_travel_times(graph)
    for source, target, key, edge in graph.edges(keys=True, data=True):
        edge["edge_id"] = f"{source}:{target}:{key}"
    return graph


def load_graph(path: Path = GRAPH_PATH) -> nx.MultiDiGraph:
    if path.exists():
        logger.info("Loading road graph from %s", path)
        return prepare_graph(ox.io.load_graphml(path))

    path.parent.mkdir(parents=True, exist_ok=True)
    ox.settings.cache_folder = str(path.parent / "overpass")
    ox.settings.use_cache = True
    ox.settings.requests_timeout = 180
    logger.info("Downloading Santa Rosa driving graph (2500 m bounding-box distance)")
    graph = prepare_graph(ox.graph.graph_from_point(
        CENTER, dist=DISTANCE_M, dist_type="bbox", network_type="drive",
        simplify=True, retain_all=False, truncate_by_edge=False,
    ))
    # Replace only after writing succeeds, so interrupted writes are not cached.
    temporary = path.with_suffix(".tmp.graphml")
    ox.io.save_graphml(graph, temporary)
    temporary.replace(path)
    logger.info("Cached %s nodes and %s edges", len(graph), graph.number_of_edges())
    return graph
