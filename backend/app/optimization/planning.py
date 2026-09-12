"""One atomic application path for structured and parsed incident batches."""

import networkx as nx
import logging

from app.data.incidents import IncidentState, derive_graph
from app.models.incidents import IncidentRequest
from app.models.scenario import ScenarioResponse
from app.optimization.dispatch import plan_transportation


def apply_incidents(graph: nx.MultiDiGraph, scenario: ScenarioResponse,
                    state: IncidentState, requests: list[IncidentRequest]):
    with state.lock:
        candidate = IncidentState()
        candidate.active = list(state.active)
        normalized = []
        for request in requests:
            incident, candidate.active = candidate.propose(graph, request, scenario)
            normalized.append(incident)
        plan = plan_transportation(derive_graph(graph, candidate.active), scenario, candidate.active)
        state.active = candidate.active
        logging.getLogger(__name__).info("Applied %d incident updates; %d active incidents", len(normalized), len(state.active))
        return normalized, plan
