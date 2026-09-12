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


class IncidentNotFound(ValueError):
    pass


def resolve_incident(graph: nx.MultiDiGraph, scenario: ScenarioResponse,
                     state: IncidentState, incident_id: str):
    """Removes exactly one active incident (e.g. once its real dispatched responder has
    actually reached it) and recomputes the plan — the same atomic
    remove-then-replan-under-lock shape as apply_incidents, just subtracting instead of
    adding. Any other concurrently active incidents are left untouched."""
    with state.lock:
        if not any(i.id == incident_id for i in state.active):
            raise IncidentNotFound(f"No active incident with id {incident_id!r}")
        remaining = [i for i in state.active if i.id != incident_id]
        plan = plan_transportation(derive_graph(graph, remaining), scenario, remaining)
        state.active = remaining
        logging.getLogger(__name__).info("Resolved incident %s; %d active incidents remain", incident_id, len(remaining))
        return plan
