"use client";

// Emergency vehicle marker layer.
//   map component -> this layer -> lib/services/dataService -> mock data (today) / backend (later)
// Selection is lifted to the parent screen (so the Fleet panel and the map stay in sync);
// this layer just reacts to `selectedVehicleId` by centering the map and highlighting the
// matching marker. No routing is computed here — `vehicle.route` is a fixed mock path,
// drawn as-is only when that vehicle is selected.
import { useEffect, useRef, useState } from "react";
import { Marker, Polyline, Popup, useMap } from "react-leaflet";
import type L from "leaflet";
import type { RouteUpdateEvent, Vehicle, VehicleRoute } from "@/lib/models";
import { getRerouteEvent, getVehicleRoute, getVehicles } from "@/lib/services/dataService";
import { useTickingEta } from "@/lib/useTickingEta";
import { interpolateRoute, truncateRoute } from "@/lib/routeMotion";
import type { RerouteState } from "@/lib/reroute";
import { roadClosureIcon, routeEndpointIcon, vehicleIcon } from "./markerIcons";

const ACTIVE_STATUSES = new Set(["en_route", "on_scene"]);
// One full pass down the route every 45s — a deliberately unhurried, readable pace.
const CYCLE_MS = 45000;
const TICK_MS = 250;

interface VehicleLayerProps {
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
  // Only ever set for the currently-selected vehicle — the parent resets it to null
  // whenever selection changes, so this layer doesn't need to re-check the id itself.
  reroute: RerouteState | null;
  // Phase 10 "Emergency Routes" layer toggle: hides just the route/detour polylines while
  // vehicle markers themselves stay controlled by the separate "Fleet" toggle.
  showRoutes?: boolean;
}

export default function VehicleLayer({
  selectedVehicleId,
  onSelectVehicle,
  reroute,
  showRoutes = true,
}: VehicleLayerProps) {
  const [fetchedVehicles, setFetchedVehicles] = useState<Vehicle[]>([]);
  const vehicles = useTickingEta(fetchedVehicles);
  const markerRefs = useRef(new Map<string, L.Marker>());
  const map = useMap();

  // Drives the along-route animation for every actively-moving vehicle at once. A single
  // shared clock (rather than one timer per vehicle) is enough since each vehicle's own
  // route shape still makes their movement look independent.
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getVehicles().then((data) => {
      if (!cancelled) setFetchedVehicles(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      setProgress(((Date.now() - start) % CYCLE_MS) / CYCLE_MS);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!selectedVehicleId) return;
    const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
    if (!vehicle) return;
    map.flyTo([vehicle.latitude, vehicle.longitude], Math.max(map.getZoom(), 14), { duration: 0.6 });
    markerRefs.current.get(vehicle.id)?.openPopup();
  }, [selectedVehicleId, vehicles, map]);

  // The drawn route line + endpoint markers come from the dedicated route service (not
  // vehicle.route, which only exists to drive the movement animation below) — this is the
  // seam a real backend route API will replace later.
  const [selectedRoute, setSelectedRoute] = useState<VehicleRoute | null>(null);
  const [rerouteEvent, setRerouteEvent] = useState<RouteUpdateEvent | null>(null);

  useEffect(() => {
    if (!selectedVehicleId) {
      setSelectedRoute(null);
      setRerouteEvent(null);
      return;
    }
    let cancelled = false;
    getVehicleRoute(selectedVehicleId).then((route) => {
      if (!cancelled) setSelectedRoute(route);
    });
    getRerouteEvent(selectedVehicleId).then((event) => {
      if (!cancelled) setRerouteEvent(event);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedVehicleId]);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);

  // Once a reroute is underway, the original route fades instead of disappearing — it's
  // still useful context ("this is the route that got affected") — while the alternate
  // route draws in with the same bright/glowing treatment the original had.
  const rerouteActive = reroute && reroute.stage !== "idle";
  const showAlternate = rerouteActive && rerouteEvent && (reroute!.stage === "rerouting" || reroute!.stage === "rerouted");
  const alternateCoordinates =
    showAlternate && rerouteEvent
      ? truncateRoute(rerouteEvent.alternate_coordinates, reroute!.stage === "rerouted" ? 1 : reroute!.progress)
      : [];

  return (
    <>
      {showRoutes && selectedRoute && selectedRoute.coordinates.length > 1 && (
        <>
          <Polyline
            positions={selectedRoute.coordinates.map((p): [number, number] => [p.latitude, p.longitude])}
            pathOptions={
              rerouteActive
                ? { color: "var(--text-muted)", weight: 3, dashArray: "4 8", opacity: 0.5 }
                : { color: "var(--active)", weight: 4, dashArray: "10 8", className: "route-flow" }
            }
          />
          <Marker
            position={[selectedRoute.origin.latitude, selectedRoute.origin.longitude]}
            icon={routeEndpointIcon("origin")}
          />
          <Marker
            position={[selectedRoute.destination.latitude, selectedRoute.destination.longitude]}
            icon={routeEndpointIcon("destination")}
          >
            <Popup>
              <div className="marker-popup">
                <div className="marker-popup-title">{selectedRoute.destination_name}</div>
                <div className="marker-popup-row">
                  <span>Route status</span>
                  <span>{selectedRoute.status}</span>
                </div>
              </div>
            </Popup>
          </Marker>
        </>
      )}

      {showRoutes && alternateCoordinates.length > 1 && (
        <Polyline
          positions={alternateCoordinates.map((p): [number, number] => [p.latitude, p.longitude])}
          pathOptions={{ color: "var(--active)", weight: 5, dashArray: "10 8", className: "route-flow" }}
        />
      )}

      {showRoutes && rerouteActive && rerouteEvent && (
        <Marker
          position={[rerouteEvent.closure_point.latitude, rerouteEvent.closure_point.longitude]}
          icon={roadClosureIcon(false)}
        >
          <Popup>
            <div className="marker-popup">
              <div className="marker-popup-title">Bridge Road — Closed</div>
              <div className="marker-popup-sub">Debris reported</div>
            </div>
          </Popup>
        </Marker>
      )}

      {vehicles.map((vehicle) => {
        const selected = vehicle.id === selectedVehicleId;
        // Once this vehicle's reroute has fully drawn in, its movement continues along the
        // new path instead of the original one — the same predetermined mock coordinates
        // used for the drawn line above, not a recomputed one.
        const isRerouted = selected && reroute?.stage === "rerouted" && rerouteEvent;
        const motionPath = isRerouted ? rerouteEvent!.alternate_coordinates : vehicle.route;
        const moving = ACTIVE_STATUSES.has(vehicle.status) && motionPath.length > 1;
        const display = moving
          ? interpolateRoute(motionPath, progress)
          : { latitude: vehicle.latitude, longitude: vehicle.longitude, headingDeg: null };
        return (
          <Marker
            key={vehicle.id}
            position={[display.latitude, display.longitude]}
            icon={vehicleIcon(vehicle.type, vehicle.status, selected, moving ? display.headingDeg : null)}
            ref={(instance) => {
              if (instance) markerRefs.current.set(vehicle.id, instance);
              else markerRefs.current.delete(vehicle.id);
            }}
            eventHandlers={{ click: () => onSelectVehicle(vehicle.id) }}
          >
            <Popup>
              <div className="marker-popup">
                <div className="marker-popup-title">{vehicle.callsign}</div>
                <div className="marker-popup-sub">{vehicle.type.replace(/_/g, " ")}</div>
                <div className="marker-popup-row">
                  <span>Status</span>
                  <span>{vehicle.status.replace(/_/g, " ")}</span>
                </div>
                <div className="marker-popup-row">
                  <span>Destination</span>
                  <span>{vehicle.destination ?? "—"}</span>
                </div>
                <div className="marker-popup-row">
                  <span>ETA</span>
                  <span>{vehicle.eta_minutes !== null ? `${vehicle.eta_minutes} min` : "—"}</span>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
