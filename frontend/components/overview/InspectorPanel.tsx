"use client";

// The one "tell me everything about this thing" surface for every clickable entity
// (vehicle, incident, closure, shelter, zone) — replaces the old small ContextDrawer and
// the vehicle-only RoutePanel with a single, much larger inspection panel. Every field is
// read straight off the already-fetched, backend-derived entity; anything the backend
// doesn't provide is a labeled "Unavailable" rather than invented.
import { useEffect, useState, type ReactNode } from "react";
import type { EvacuationZone, Incident, RoadClosure, RouteUpdateEvent, Shelter, Vehicle, VehicleRoute } from "@/lib/models";
import { getRerouteEvent, getVehicleRoute } from "@/lib/services/dataService";
import { useCountdownSeconds, formatMinSec } from "@/lib/useCountdown";
import { formatClock } from "@/lib/useRelativeTime";
import type { RerouteState } from "@/lib/reroute";
import type { SelectionState } from "@/lib/selection";
import { CLOSURE_SHAPE, INCIDENT_SHAPE, SHELTER_SHAPE, VEHICLE_SHAPE, ZONE_SHAPE, shapeClassName, type EntityShape } from "@/lib/entitySymbols";

interface InspectorPanelProps {
  selection: SelectionState;
  incidents: Incident[];
  closures: RoadClosure[];
  shelters: Shelter[];
  zones: EvacuationZone[];
  vehicles: Vehicle[];
  reroute: RerouteState | null;
  onSimulateClosure: () => void;
  onReplayReroute: () => void;
  onResetReroute: () => void;
  onClose: () => void;
}

interface Row {
  label: string;
  value: string;
}

const UNAVAILABLE = "Unavailable";

function severityStatusClass(severity: string): string {
  if (severity === "critical") return "dot-critical";
  if (severity === "high") return "dot-warning";
  if (severity === "medium") return "dot-caution";
  return "dot-inactive";
}

function zoneStatusClass(status: EvacuationZone["status"]): string {
  if (status === "mandatory") return "dot-critical";
  if (status === "warning") return "dot-warning";
  if (status === "advisory") return "dot-caution";
  return "dot-safe";
}

function shelterStatusClass(pct: number): string {
  if (pct >= 95) return "dot-critical";
  if (pct >= 70) return "dot-caution";
  return "dot-safe";
}

function Field({ label, value }: Row) {
  return (
    <div className="inspector-row">
      <span className="inspector-row-label">{label}</span>
      <span className="inspector-row-value">{value}</span>
    </div>
  );
}

// A tiny dedicated component (rather than calling useCountdownSeconds directly inside
// InspectorPanel's incident branch) so the hook is always called unconditionally on every
// render of THIS component, regardless of the parent's early returns for other selection
// kinds — calling it conditionally there would violate the Rules of Hooks.
function ResponseEtaMetric({ etaMinutes }: { etaMinutes: number }) {
  const countdown = useCountdownSeconds(etaMinutes);
  return (
    <div>
      <div className="inspector-metric-label">Nearest Response ETA</div>
      <div className="inspector-metric-value">{formatMinSec(countdown)}</div>
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="inspector-section">
      <div className="inspector-section-heading">{heading}</div>
      {children}
    </div>
  );
}

function Shell({
  shape,
  statusClass,
  title,
  subtitle,
  onClose,
  children,
}: {
  shape: EntityShape;
  statusClass: string;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="inspector-panel">
      <button type="button" className="inspector-close" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <div className="inspector-header">
        <span className={`inspector-accent ${shapeClassName(shape)} ${statusClass}`} aria-hidden="true" />
        <div>
          <div className="inspector-title">{title}</div>
          <div className="inspector-subtitle">{subtitle}</div>
        </div>
      </div>
      <div className="inspector-body">{children}</div>
    </div>
  );
}

function VehicleInspector({
  vehicle,
  reroute,
  onSimulateClosure,
  onReplayReroute,
  onResetReroute,
  onClose,
}: {
  vehicle: Vehicle;
  reroute: RerouteState | null;
  onSimulateClosure: () => void;
  onReplayReroute: () => void;
  onResetReroute: () => void;
  onClose: () => void;
}) {
  const [route, setRoute] = useState<VehicleRoute | null | undefined>(undefined);
  const [rerouteEvent, setRerouteEvent] = useState<RouteUpdateEvent | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRoute(undefined);
    getVehicleRoute(vehicle.id).then((result) => {
      if (!cancelled) setRoute(result);
    });
    getRerouteEvent(vehicle.id).then((result) => {
      if (!cancelled) setRerouteEvent(result);
    });
    return () => {
      cancelled = true;
    };
  }, [vehicle.id]);

  const rerouted = reroute?.stage === "rerouted";
  const rerouteInProgress = reroute?.stage === "activating" || reroute?.stage === "rerouting";
  const activeEtaMinutes = rerouted && rerouteEvent ? rerouteEvent.alternate_eta_minutes : route?.eta_minutes ?? null;
  const activeDistanceMiles = rerouted && rerouteEvent ? rerouteEvent.alternate_distance_miles : route?.distance_miles;
  const countdown = useCountdownSeconds(route ? activeEtaMinutes : null);

  const vehicleStatusClass =
    vehicle.status === "en_route" || vehicle.status === "on_scene"
      ? "dot-response"
      : vehicle.status === "available"
        ? "dot-safe"
        : "dot-inactive";

  return (
    <Shell
      shape={VEHICLE_SHAPE}
      statusClass={vehicleStatusClass}
      title={vehicle.callsign}
      subtitle={`${vehicle.type.replace(/_/g, " ")} · ${vehicle.status.replace(/_/g, " ")}`}
      onClose={onClose}
    >
      {route === undefined && <p className="empty-note">Loading route…</p>}

      {route === null && <p className="empty-note">No active route.</p>}

      {route && (
        <>
          <div className="inspector-metric-row">
            <div>
              <div className="inspector-metric-label">ETA</div>
              <div className="inspector-metric-value">{formatMinSec(countdown)}</div>
            </div>
          </div>

          <Section heading="Destination">
            <Field label="Location" value={route.destination_name} />
          </Section>

          <Section heading="Route">
            <Field label="Distance" value={activeDistanceMiles !== undefined ? `${activeDistanceMiles.toFixed(1)} mi` : UNAVAILABLE} />
            <Field label="Status" value={rerouted ? "Rerouted" : rerouteInProgress ? "Affected" : route.status} />
            <Field label="Priority" value={route.priority} />
          </Section>

          {reroute && reroute.stage !== "idle" && rerouteEvent && (
            <div className="route-update-banner">
              <div className="route-update-banner-title">{rerouteInProgress ? "Route Update In Progress" : "Route Update"}</div>
              <div className="route-update-banner-message">{rerouteEvent.message}</div>
            </div>
          )}

          <div className="inspector-actions">
            {(!reroute || reroute.stage === "idle") && rerouteEvent && (
              <button type="button" className="op-button op-button-danger" onClick={onSimulateClosure}>
                Simulate Closure
              </button>
            )}
            {rerouted && (
              <>
                <button type="button" className="op-button" onClick={onReplayReroute}>
                  Replay
                </button>
                <button type="button" className="op-button" onClick={onResetReroute}>
                  Reset
                </button>
              </>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}

export default function InspectorPanel({
  selection,
  incidents,
  closures,
  shelters,
  zones,
  vehicles,
  reroute,
  onSimulateClosure,
  onReplayReroute,
  onResetReroute,
  onClose,
}: InspectorPanelProps) {
  if (!selection) return null;

  if (selection.kind === "vehicle") {
    const vehicle = vehicles.find((v) => v.id === selection.id);
    if (!vehicle) return null;
    return (
      <VehicleInspector
        vehicle={vehicle}
        reroute={reroute}
        onSimulateClosure={onSimulateClosure}
        onReplayReroute={onReplayReroute}
        onResetReroute={onResetReroute}
        onClose={onClose}
      />
    );
  }

  if (selection.kind === "incident") {
    const incident = incidents.find((i) => i.id === selection.id);
    if (!incident) return null;
    // A dispatched responder's real `destination` is the real incident id it was assigned
    // to (see backend/app/optimization/dispatch.py) — so this is a genuine cross-reference,
    // not a guess, and its eta_minutes is the same real travel-time figure the Fleet rail
    // and the vehicle's own panel already show.
    const responders = vehicles.filter((v) => v.destination === incident.id);
    return (
      <Shell
        shape={INCIDENT_SHAPE}
        statusClass={severityStatusClass(incident.severity)}
        title={incident.reportedTypeLabel ?? incident.type.replace(/_/g, " ")}
        subtitle={incident.zone_id ? `Zone ${incident.zone_id.split("-").pop()?.toUpperCase()}` : "Location unavailable"}
        onClose={onClose}
      >
        <div className="inspector-metric-row">
          <div>
            <div className="inspector-metric-label">Severity</div>
            <div className="inspector-metric-value inspector-metric-value-uppercase">{incident.severity}</div>
          </div>
          {responders.length > 0 && responders[0].eta_minutes !== null && (
            <ResponseEtaMetric etaMinutes={responders[0].eta_minutes} />
          )}
        </div>
        <Section heading="Status">
          <Field label="Status" value={incident.status.replace(/_/g, " ")} />
          <Field label="Zone" value={incident.zone_id ?? UNAVAILABLE} />
          <Field label="Reported" value={formatClock(incident.reported_at)} />
        </Section>
        {responders.length > 0 && (
          <Section heading="Emergency Response">
            {responders.map((responder) => (
              <Field
                key={responder.id}
                label={responder.callsign}
                value={responder.eta_minutes !== null ? `${responder.eta_minutes} min ETA` : "En route"}
              />
            ))}
          </Section>
        )}
      </Shell>
    );
  }

  if (selection.kind === "closure") {
    const closure = closures.find((c) => c.id === selection.id);
    if (!closure) return null;
    return (
      <Shell
        shape={CLOSURE_SHAPE}
        statusClass={severityStatusClass(closure.severity)}
        title="Road Closure"
        subtitle={closure.road_name}
        onClose={onClose}
      >
        <div className="inspector-metric-row">
          <div>
            <div className="inspector-metric-label">Severity</div>
            <div className="inspector-metric-value inspector-metric-value-uppercase">{closure.severity}</div>
          </div>
        </div>
        <Section heading="Details">
          <Field label="Reason" value={closure.reason} />
          <Field label="Status" value={closure.status} />
          <Field label="Reported" value={formatClock(closure.reported_at)} />
        </Section>
      </Shell>
    );
  }

  if (selection.kind === "shelter") {
    const shelter = shelters.find((s) => s.id === selection.id);
    if (!shelter) return null;
    const pct = shelter.capacity > 0 ? Math.round((shelter.occupancy / shelter.capacity) * 100) : 0;
    const available = Math.max(0, shelter.capacity - shelter.occupancy);
    return (
      <Shell
        shape={SHELTER_SHAPE}
        statusClass={shelterStatusClass(pct)}
        title={shelter.name}
        subtitle={shelter.address || "Address unavailable"}
        onClose={onClose}
      >
        <div className="inspector-metric-row">
          <div>
            <div className="inspector-metric-label">Occupied</div>
            <div className="inspector-metric-value">{pct}%</div>
            <div className="inspector-metric-sub">
              {shelter.occupancy.toLocaleString()} / {shelter.capacity.toLocaleString()}
            </div>
          </div>
        </div>
        <Section heading="Capacity">
          <Field label="Available" value={available.toLocaleString()} />
          <Field label="Status" value={shelter.status} />
        </Section>
      </Shell>
    );
  }

  const zone = zones.find((z) => z.id === selection.id);
  if (!zone) return null;
  return (
    <Shell shape={ZONE_SHAPE} statusClass={zoneStatusClass(zone.status)} title={zone.name} subtitle="Evacuation Zone" onClose={onClose}>
      <div className="inspector-metric-row">
        <div>
          <div className="inspector-metric-label">Order</div>
          <div className="inspector-metric-value inspector-metric-value-uppercase">{zone.status}</div>
        </div>
      </div>
      <Section heading="Population">
        <Field label="Population" value={zone.population.toLocaleString()} />
      </Section>
    </Shell>
  );
}
