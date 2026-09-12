"use client";

// Shows the selected vehicle's active dispatch route, plus (for vehicles with a
// predetermined scenario) the "SIMULATE CLOSURE" reroute demo.
//   map/panel component -> getVehicleRoute()/getRerouteEvent() -> mock data (today) / backend (later)
import { useEffect, useState } from "react";
import type { RouteUpdateEvent, Vehicle, VehicleRoute, VehicleRouteStatus } from "@/lib/models";
import { getRerouteEvent, getVehicleRoute } from "@/lib/services/dataService";
import { useCountdownSeconds, formatMinSec } from "@/lib/useCountdown";
import type { RerouteState } from "@/lib/reroute";
import OverviewPanel from "./OverviewPanel";

const ROUTE_STATUS_DOT: Record<VehicleRouteStatus, string> = {
  clear: "dot-safe",
  congested: "dot-caution",
  blocked: "dot-critical",
  completed: "dot-inactive",
};

interface RoutePanelProps {
  vehicle: Vehicle | null;
  reroute: RerouteState | null;
  onSimulateClosure: () => void;
  onReplay: () => void;
  onReset: () => void;
}

export default function RoutePanel({ vehicle, reroute, onSimulateClosure, onReplay, onReset }: RoutePanelProps) {
  // undefined = fetch in flight, null = fetched and confirmed no active route.
  const [route, setRoute] = useState<VehicleRoute | null | undefined>(null);
  const [rerouteEvent, setRerouteEvent] = useState<RouteUpdateEvent | null>(null);

  useEffect(() => {
    if (!vehicle) {
      setRoute(null);
      setRerouteEvent(null);
      return;
    }
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
  }, [vehicle]);

  const rerouted = reroute?.stage === "rerouted";
  const rerouteInProgress = reroute?.stage === "activating" || reroute?.stage === "rerouting";

  const activeEtaMinutes = rerouted && rerouteEvent ? rerouteEvent.alternate_eta_minutes : route?.eta_minutes ?? null;
  const activeDistanceMiles = rerouted && rerouteEvent ? rerouteEvent.alternate_distance_miles : route?.distance_miles;
  const countdown = useCountdownSeconds(route ? activeEtaMinutes : null);

  if (!vehicle) {
    return (
      <OverviewPanel title="Active Route">
        <p className="empty-note">Select a vehicle to view its route.</p>
      </OverviewPanel>
    );
  }

  if (route === undefined) {
    return (
      <OverviewPanel title="Active Route">
        <p className="empty-note">Loading route…</p>
      </OverviewPanel>
    );
  }

  if (route === null) {
    return (
      <OverviewPanel title="Active Route">
        <div className="route-panel-header">
          <span className="route-panel-callsign">{vehicle.callsign}</span>
          <span className="ov-row-tag">{vehicle.status.replace(/_/g, " ")}</span>
        </div>
        <p className="empty-note">No active route.</p>
      </OverviewPanel>
    );
  }

  return (
    <OverviewPanel title="Active Route">
      <div className="route-panel-header">
        <span className="route-panel-callsign">{vehicle.callsign}</span>
        <span className="ov-row-tag">{vehicle.status.replace(/_/g, " ")}</span>
      </div>
      <div className="route-panel-destination">{route.destination_name}</div>

      <div className="incident-hero-grid route-panel-stats">
        <div>
          <div className="incident-hero-stat-label">ETA</div>
          <div className="incident-hero-stat-value route-panel-eta">{formatMinSec(countdown)}</div>
        </div>
        <div>
          <div className="incident-hero-stat-label">Distance</div>
          <div className="incident-hero-stat-value">{activeDistanceMiles?.toFixed(1)} mi</div>
        </div>
      </div>

      <div className="ov-row-detail">
        <div className="ov-row-detail-line">
          <span>
            <span
              className={`ov-dot ${rerouteInProgress || rerouted ? "dot-warning" : ROUTE_STATUS_DOT[route.status]}`}
              aria-hidden="true"
              style={{ marginRight: 6 }}
            />
            Route Status
          </span>
          <span>{rerouted ? "Rerouted" : rerouteInProgress ? "Affected" : route.status}</span>
        </div>
        <div className="ov-row-detail-line">
          <span>Priority</span>
          <span>{route.priority}</span>
        </div>
      </div>

      {reroute && reroute.stage !== "idle" && rerouteEvent && (
        <div className="route-update-banner">
          <div className="route-update-banner-title">
            {rerouteInProgress ? "Route Update In Progress" : "Route Update"}
          </div>
          <div className="route-update-banner-message">{rerouteEvent.message}</div>
        </div>
      )}

      <div className="route-panel-actions">
        {(!reroute || reroute.stage === "idle") && rerouteEvent && (
          <button type="button" className="op-button op-button-danger" onClick={onSimulateClosure}>
            Simulate Closure
          </button>
        )}
        {rerouted && (
          <>
            <button type="button" className="op-button" onClick={onReplay}>
              Replay
            </button>
            <button type="button" className="op-button" onClick={onReset}>
              Reset
            </button>
          </>
        )}
      </div>
    </OverviewPanel>
  );
}
