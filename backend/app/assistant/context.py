"""Builds the compact, real operational snapshot handed to the assistant model.

Every field here is read straight off the same scenario/plan objects GET /scenario and
POST /optimize already return to the frontend — nothing is invented for the assistant. The
full scenario payload is large (roads, boundaries, full coordinate lists); this trims it down
to what a dispatcher-style question actually needs, so the model reasons over real counts and
IDs instead of guessing.
"""

from app.models.incidents import IncidentPlan
from app.models.scenario import ScenarioResponse

MAX_LIST_ITEMS = 40

# Mirrors frontend/lib/services/dataService.ts's CLOSURE_TYPES split: the same backend
# incident list feeds both the "Active Incidents" and "Road Closures" rails there, and the
# selection kind (which InspectorPanel branch opens) depends on this same categorization.
CLOSURE_TYPES = {"ROAD_CLOSURE", "ROAD_DAMAGE", "DEBRIS", "HAZARD_UPDATE"}


def reference_kind_for_incident(incident_type: str) -> str:
    return "closure" if incident_type in CLOSURE_TYPES else "incident"


def build_state_snapshot(scenario: ScenarioResponse, plan: IncidentPlan) -> dict:
    active_incidents = [
        {
            "id": incident.id,
            "ref_kind": reference_kind_for_incident(incident.type),
            "type": incident.type,
            "severity": incident.severity,
            "zone": incident.zone,
            "injuries": incident.injuries,
        }
        for incident in plan.incidents[:MAX_LIST_ITEMS]
    ]

    dispatched_by_id = {route.id: route for route in [*plan.ambulances, *plan.rescue_teams]}
    vehicles = [
        {
            "id": resource.id,
            "callsign": resource.name,
            "type": resource.type,
            "status": "en_route" if resource.id in dispatched_by_id else resource.availability_status,
            "destination": dispatched_by_id[resource.id].destination if resource.id in dispatched_by_id else None,
            "incident_id": dispatched_by_id[resource.id].incident_id if resource.id in dispatched_by_id else None,
            "eta_minutes": round(dispatched_by_id[resource.id].travel_time_s / 60) if resource.id in dispatched_by_id else None,
            "distance_miles": round(dispatched_by_id[resource.id].distance_m / 1609.34, 1) if resource.id in dispatched_by_id else None,
        }
        for resource in scenario.emergency_resources[:MAX_LIST_ITEMS]
    ]

    shelters = [
        {
            "id": shelter.id,
            "name": shelter.name,
            "status": shelter.status,
            "planning_available": shelter.planning_available,
            "capacity": shelter.capacity,
            "current_occupancy": shelter.current_occupancy,
            "available_capacity": shelter.available_capacity,
        }
        for shelter in scenario.shelters[:MAX_LIST_ITEMS]
    ]

    incident_zone_ids = {incident.zone for incident in plan.incidents if incident.zone}
    zones = [
        {
            "id": zone.id,
            "name": zone.name,
            "population": zone.population,
            "status": "mandatory evacuation" if zone.id in incident_zone_ids else "clear",
        }
        for zone in scenario.zones[:MAX_LIST_ITEMS]
    ]

    evacuation_routes = [
        {
            "zone": route.zone_name,
            "shelter": route.shelter_name,
            "people": route.people,
            "travel_time_minutes": round(route.effective_travel_time_s / 60),
        }
        for route in plan.evacuation_routes[:MAX_LIST_ITEMS]
    ]

    road_closures = [
        {"id": incident.id, "ref_kind": "closure", "type": incident.type, "severity": incident.severity}
        for incident in plan.incidents
        if incident.type in ("ROAD_CLOSURE", "ROAD_DAMAGE", "DEBRIS")
    ]

    return {
        "scenario_name": scenario.scenario.name,
        "location": scenario.scenario.location,
        "active_incidents": active_incidents,
        "road_closures": road_closures,
        "vehicles": vehicles,
        "shelters": shelters,
        "evacuation_zones": zones,
        "evacuation_routes": evacuation_routes,
        "metrics": {
            "total_evacuees": plan.metrics.total_evacuees,
            "assigned_evacuees": plan.metrics.assigned_evacuees,
            "average_travel_time_minutes": round(plan.metrics.average_effective_travel_time_s / 60, 1),
            "ambulances_dispatched": plan.metrics.ambulances_dispatched,
            "rescue_teams_dispatched": plan.metrics.rescue_teams_dispatched,
            "uncovered_injuries": plan.metrics.uncovered_injuries,
        },
    }


def resolve_reference(kind: str, ref_id: str, scenario: ScenarioResponse, plan: IncidentPlan) -> str | None:
    """Looks up a real, current label for a {{kind:id}} marker the model emitted — never
    trusts the model's own wording, only the id it points at."""
    if kind in ("incident", "closure"):
        incident = next((i for i in plan.incidents if i.id == ref_id), None)
        if not incident:
            return None
        base = incident.type.replace("_", " ").title()
        return f"{base} ({incident.zone})" if incident.zone else base
    if kind == "vehicle":
        resource = next((r for r in scenario.emergency_resources if r.id == ref_id), None)
        return resource.name if resource else None
    if kind == "shelter":
        shelter = next((s for s in scenario.shelters if s.id == ref_id), None)
        return shelter.name if shelter else None
    if kind == "zone":
        zone = next((z for z in scenario.zones if z.id == ref_id), None)
        return zone.name if zone else None
    return None
