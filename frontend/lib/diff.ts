// Computes a human-readable summary of what changed between two scenario states.
// Drives the before/after replanning banner, the centerpiece of the demo.
import type { ScenarioState } from "./types";

export function diffScenarios(before: ScenarioState, after: ScenarioState): string[] {
  const changes: string[] = [];

  const beforeRoadRefs = new Set(before.blockedRoads.map((r) => r.roadRef));
  for (const road of after.blockedRoads) {
    if (!beforeRoadRefs.has(road.roadRef)) {
      changes.push(`${road.roadRef} blocked: ${road.reason}`);
      break;
    }
  }

  const beforeStatus = new Map(before.zones.map((z) => [z.id, z.status]));
  for (const zone of after.zones) {
    const prev = beforeStatus.get(zone.id);
    if (prev && prev !== zone.status) {
      changes.push(`${zone.name} status changed from ${prev} to ${zone.status}`);
    }
  }

  const afterZoneShelters = new Map<string, Set<string>>();
  for (const a of after.assignments) {
    if (!afterZoneShelters.has(a.zoneId)) afterZoneShelters.set(a.zoneId, new Set());
    afterZoneShelters.get(a.zoneId)!.add(a.shelterId);
  }
  const beforeZoneShelters = new Map<string, Set<string>>();
  for (const a of before.assignments) {
    if (!beforeZoneShelters.has(a.zoneId)) beforeZoneShelters.set(a.zoneId, new Set());
    beforeZoneShelters.get(a.zoneId)!.add(a.shelterId);
  }
  for (const [zoneId, afterShelterIds] of afterZoneShelters) {
    const beforeShelterIds = beforeZoneShelters.get(zoneId);
    if (!beforeShelterIds) continue;
    const changed = [...afterShelterIds].some((id) => !beforeShelterIds.has(id));
    if (changed) {
      const zoneName = after.assignments.find((a) => a.zoneId === zoneId)?.zoneName ?? zoneId;
      changes.push(`${zoneName} reassigned to a different shelter`);
    }
  }

  const beforeAmbulanceDest = new Map(before.ambulances.map((a) => [a.id, a.destinationZoneId]));
  for (const ambulance of after.ambulances) {
    const prevDest = beforeAmbulanceDest.get(ambulance.id);
    if (!prevDest) {
      changes.push(`${ambulance.id} dispatched to ${ambulance.destinationZoneName}`);
    } else if (prevDest !== ambulance.destinationZoneId) {
      changes.push(`${ambulance.id} redirected to ${ambulance.destinationZoneName}`);
    }
  }

  return changes;
}
