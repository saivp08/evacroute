"use client";

// Real-time change detection layered ON TOP OF the existing data-service getters — not a
// second data source. The backend has no push/event/websocket endpoint today (see
// backend/app/main.py: only /health, /scenario, /optimize, /incident(s)), so this hook
// polls the same getIncidents()/getRoadClosures()/getShelters()/getVehicles() calls the
// rest of the UI already uses, diffs each poll against the previous one, and turns real
// differences into typed OperationalEvent records. Every field in every event is read
// straight off an entity the data service actually returned — nothing here is invented.
// If the backend later adds a real event/websocket feed, replace the polling loop below
// with a subscription and keep the rest of this file (the diffing/event shape) as-is.
import { useEffect, useRef, useState } from "react";
import type { Incident, OperationalEvent, RoadClosure, Shelter, Vehicle } from "./models";
import { getIncidents, getRoadClosures, getShelters, getVehicles } from "./services/dataService";
import { invalidateBackendState } from "./services/backendClient";

export const LIVE_POLL_MS = 10000;
const MAX_EVENTS = 50;
const SHELTER_NEAR_CAPACITY_PCT = 90;

interface Snapshot {
  incidents: Map<string, Incident>;
  closures: Map<string, RoadClosure>;
  shelters: Map<string, Shelter>;
  vehicles: Map<string, Vehicle>;
}

function toMap<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function diffSnapshots(prev: Snapshot, next: Snapshot): OperationalEvent[] {
  const events: OperationalEvent[] = [];
  const now = new Date().toISOString();

  for (const [id, incident] of next.incidents) {
    if (!prev.incidents.has(id)) {
      events.push({
        id: `incident-${id}-${now}`,
        kind: "incident",
        severity: incident.severity === "critical" || incident.severity === "high" ? "critical" : "warning",
        message: `${incident.type.replace(/_/g, " ")} reported`,
        detail: incident.zone_id ? `Zone ${incident.zone_id} — ${incident.severity} severity` : `${incident.severity} severity`,
        timestamp: now,
        entityId: id,
      });
    }
  }

  for (const [id, closure] of next.closures) {
    if (!prev.closures.has(id)) {
      events.push({
        id: `closure-${id}-${now}`,
        kind: "closure",
        severity: "critical",
        message: `${closure.road_name} closed`,
        detail: closure.reason,
        timestamp: now,
        entityId: id,
      });
    }
  }

  for (const [id, shelter] of next.shelters) {
    const before = prev.shelters.get(id);
    if (!before) continue;
    const pctBefore = before.capacity > 0 ? (before.occupancy / before.capacity) * 100 : 0;
    const pctAfter = shelter.capacity > 0 ? (shelter.occupancy / shelter.capacity) * 100 : 0;
    if (before.occupancy !== shelter.occupancy) {
      const crossedThreshold = pctBefore < SHELTER_NEAR_CAPACITY_PCT && pctAfter >= SHELTER_NEAR_CAPACITY_PCT;
      events.push({
        id: `shelter-${id}-${now}`,
        kind: "shelter",
        severity: crossedThreshold || shelter.status === "full" ? "warning" : "info",
        message: crossedThreshold ? `${shelter.name} approaching capacity` : `${shelter.name} occupancy updated`,
        detail: `${shelter.occupancy.toLocaleString()} / ${shelter.capacity.toLocaleString()}`,
        timestamp: now,
        entityId: id,
      });
    }
  }

  for (const [id, vehicle] of next.vehicles) {
    const before = prev.vehicles.get(id);
    if (before && before.status !== vehicle.status) {
      events.push({
        id: `vehicle-${id}-${now}`,
        kind: "vehicle",
        severity: "info",
        message: `${vehicle.callsign} status changed to ${vehicle.status.replace(/_/g, " ")}`,
        detail: vehicle.destination,
        timestamp: now,
        entityId: id,
      });
    }
  }

  return events;
}

// Returns the accumulated event log (newest first, capped at MAX_EVENTS) for the Live
// Operations stream. `onNewEvents`, if given, fires once per poll with just that poll's new
// events (not the full accumulated list) — the caller uses this to drive one-shot UI like
// toasts and the critical alert banner without re-diffing the returned array itself.
export function useLiveEvents(onNewEvents?: (batch: OperationalEvent[]) => void) {
  const [events, setEvents] = useState<OperationalEvent[]>([]);
  const snapshotRef = useRef<Snapshot | null>(null);
  const onNewEventsRef = useRef(onNewEvents);
  onNewEventsRef.current = onNewEvents;

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      // Force a fresh /scenario + /optimize round trip so this poll can actually see
      // whatever changed on the backend since the last one — see invalidateBackendState's
      // doc comment for why this is necessary.
      invalidateBackendState();
      const [incidents, closures, shelters, vehicles] = await Promise.all([
        getIncidents(),
        getRoadClosures(),
        getShelters(),
        getVehicles(),
      ]);
      if (cancelled) return;

      const next: Snapshot = {
        incidents: toMap(incidents),
        closures: toMap(closures),
        shelters: toMap(shelters),
        vehicles: toMap(vehicles),
      };

      // The very first poll establishes a baseline — nothing "changed" relative to nothing,
      // so no events fire for whatever the backend already had before the page loaded.
      if (snapshotRef.current) {
        const newEvents = diffSnapshots(snapshotRef.current, next);
        if (newEvents.length > 0) {
          setEvents((prev) => [...newEvents, ...prev].slice(0, MAX_EVENTS));
          onNewEventsRef.current?.(newEvents);
        }
      }
      snapshotRef.current = next;
    }

    poll();
    const id = setInterval(poll, LIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return events;
}
