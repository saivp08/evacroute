"use client";

// Emergency vehicle marker layer (MapLibre).
//   OverviewScreen's poll loop -> this layer (via the `vehicles` prop) -> live backend
// Vehicles come in as a prop (see IncidentLayer for why) rather than a one-time internal
// fetch — a vehicle newly dispatched by a reported incident needs to actually appear moving
// on the map, not just in the Fleet rail. Selection is lifted to the parent screen (so the
// Fleet panel and the map stay in sync); this layer just reacts to `selectedVehicleId` by
// flying the camera and enlarging the matching marker. No routing/movement is invented here —
// `vehicle.route` is the backend's own dispatch route, drawn and interpolated as-is only when
// that vehicle is selected.
import { useEffect, useState } from "react";
import { Marker, Source, Layer, useMap } from "react-map-gl/maplibre";
import type { GeoJSON } from "geojson";
import type { LatLng, RouteUpdateEvent, Vehicle, VehicleRoute } from "@/lib/models";
import { getRerouteEvent, getVehicleRoute } from "@/lib/services/dataService";
import { useTickingEta } from "@/lib/useTickingEta";
import { interpolateRoute, truncateRoute } from "@/lib/routeMotion";
import type { RerouteState } from "@/lib/reroute";
import { useTheme } from "@/lib/theme";
import { getMapPalette, getVehicleTypeColor } from "@/lib/mapColors";
import { useAnimatedLineDash } from "@/lib/useAnimatedLineDash";
import MarkerBadge from "./MarkerBadge";

const RESPONSE_ROUTE_LAYER_ID = "vehicle-selected-route-line";
const RESPONSE_ROUTE_GLOW_LAYER_ID = "vehicle-selected-route-glow";
const ALTERNATE_ROUTE_LAYER_ID = "vehicle-alternate-route-line";

const ACTIVE_STATUSES = new Set(["en_route", "on_scene"]);
// One full pass down the route every 45s — a deliberately unhurried, readable pace.
const CYCLE_MS = 45000;
const TICK_MS = 250;

function toLine(coordinates: LatLng[]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: coordinates.map((p) => [p.longitude, p.latitude]) },
  };
}

interface VehicleLayerProps {
  vehicles: Vehicle[];
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
  // Only ever set for the currently-selected vehicle — the parent resets it to null
  // whenever selection changes, so this layer doesn't need to re-check the id itself.
  reroute: RerouteState | null;
  // "Emergency Routes" layer toggle: hides just the route/detour lines while vehicle
  // markers themselves stay controlled by the separate "Fleet" toggle.
  showRoutes?: boolean;
  hasSelection?: boolean;
}

export default function VehicleLayer({ vehicles: fetchedVehicles, selectedVehicleId, onSelectVehicle, reroute, showRoutes = true, hasSelection }: VehicleLayerProps) {
  const { current: map } = useMap();
  const { theme } = useTheme();
  const palette = getMapPalette(theme);
  const vehicles = useTickingEta(fetchedVehicles);

  // Drives the along-route animation for every actively-moving vehicle at once. A single
  // shared clock (rather than one timer per vehicle) is enough since each vehicle's own
  // route shape still makes their movement look independent.
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      setProgress(((Date.now() - start) % CYCLE_MS) / CYCLE_MS);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!selectedVehicleId || !map) return;
    const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
    if (!vehicle) return;
    map.flyTo({
      center: [vehicle.longitude, vehicle.latitude],
      zoom: Math.max(map.getZoom(), 16),
      duration: 900,
    });
  }, [selectedVehicleId, vehicles, map]);

  // The drawn route line + endpoint markers come from the dedicated route service (not
  // vehicle.route, which only exists to drive the movement animation below).
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

  // Once a reroute is underway, the original route fades instead of disappearing — it's
  // still useful context ("this is the route that got affected") — while the alternate
  // route draws in with the same bright treatment the original had.
  const rerouteActive = reroute && reroute.stage !== "idle";
  const showAlternate = rerouteActive && rerouteEvent && (reroute!.stage === "rerouting" || reroute!.stage === "rerouted");
  const alternateCoordinates =
    showAlternate && rerouteEvent
      ? truncateRoute(rerouteEvent.alternate_coordinates, reroute!.stage === "rerouted" ? 1 : reroute!.progress)
      : [];

  // Emergency response moves TOWARD the incident — a distinct amber from the evacuation
  // layer's teal (EvacuationRouteLayer), with the same real marching-dash direction
  // animation, so the two simultaneous flows (evacuees out, responders in) read as visually
  // opposite/independent at a glance.
  useAnimatedLineDash(
    map,
    [
      showRoutes && selectedRoute && !rerouteActive ? RESPONSE_ROUTE_LAYER_ID : null,
      showRoutes && alternateCoordinates.length > 1 ? ALTERNATE_ROUTE_LAYER_ID : null,
    ].filter((id): id is string => id !== null)
  );

  return (
    <>
      {/* Every currently-dispatched vehicle's real route glows automatically — not just the
          one the user happens to have selected — so "an emergency unit is responding" is
          visible on the map without requiring a click. The selected vehicle's own route
          (below) still gets the brighter, more detailed treatment and draws on top. */}
      {showRoutes &&
        vehicles
          .filter((vehicle) => vehicle.id !== selectedVehicleId && ACTIVE_STATUSES.has(vehicle.status) && vehicle.route.length > 1)
          .map((vehicle) => {
            const color = getVehicleTypeColor(theme, vehicle.type);
            return (
              <Source key={`route-${vehicle.id}`} id={`vehicle-route-${vehicle.id}`} type="geojson" data={toLine(vehicle.route)}>
                <Layer
                  id={`vehicle-route-${vehicle.id}-glow`}
                  type="line"
                  layout={{ "line-cap": "round", "line-join": "round" }}
                  paint={{ "line-color": color, "line-width": 10, "line-blur": 6, "line-opacity": hasSelection ? 0.15 : 0.3 }}
                />
                <Layer
                  id={`vehicle-route-${vehicle.id}-line`}
                  type="line"
                  layout={{ "line-cap": "round", "line-join": "round" }}
                  paint={{ "line-color": color, "line-width": 2.5, "line-opacity": hasSelection ? 0.35 : 0.7 }}
                />
              </Source>
            );
          })}

      {showRoutes && selectedRoute && selectedRoute.coordinates.length > 1 && (
        <Source id="vehicle-selected-route" type="geojson" data={toLine(selectedRoute.coordinates)}>
          {/* Soft halo underneath the bright core line — the "illuminated route" look,
              native to the line layer rather than a second SVG overlay. */}
          {!rerouteActive && (
            <Layer
              id={RESPONSE_ROUTE_GLOW_LAYER_ID}
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": palette.warning, "line-width": 14, "line-blur": 8, "line-opacity": 0.35 }}
            />
          )}
          <Layer
            id={RESPONSE_ROUTE_LAYER_ID}
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": rerouteActive ? palette.textMuted : palette.warning,
              "line-width": rerouteActive ? 3 : 5,
              "line-opacity": rerouteActive ? 0.5 : 0.95,
              "line-dasharray": rerouteActive ? [1, 2] : [0, 4, 3],
            }}
          />
        </Source>
      )}

      {showRoutes && alternateCoordinates.length > 1 && (
        <Source id="vehicle-alternate-route" type="geojson" data={toLine(alternateCoordinates)}>
          <Layer
            id={ALTERNATE_ROUTE_LAYER_ID}
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": palette.warning, "line-width": 6, "line-opacity": 0.9, "line-dasharray": [0, 4, 3] }}
          />
        </Source>
      )}

      {showRoutes && rerouteActive && rerouteEvent && (
        <Marker
          longitude={rerouteEvent.closure_point.longitude}
          latitude={rerouteEvent.closure_point.latitude}
          anchor="center"
        >
          <MarkerBadge color={palette.danger} size={14} pulse />
        </Marker>
      )}

      {vehicles.map((vehicle) => {
        const selected = vehicle.id === selectedVehicleId;
        // Once this vehicle's reroute has fully drawn in, its movement continues along the
        // new path instead of the original one — the same predetermined coordinates used
        // for the drawn line above, not a recomputed one.
        const isRerouted = selected && reroute?.stage === "rerouted" && rerouteEvent;
        const motionPath = isRerouted ? rerouteEvent!.alternate_coordinates : vehicle.route;
        const moving = ACTIVE_STATUSES.has(vehicle.status) && motionPath.length > 1;
        const display = moving
          ? interpolateRoute(motionPath, progress)
          : { latitude: vehicle.latitude, longitude: vehicle.longitude, headingDeg: 0 };
        const active = vehicle.status === "en_route" || vehicle.status === "on_scene";
        const color = getVehicleTypeColor(theme, vehicle.type);
        const size = selected ? 22 : 17;

        return (
          <Marker
            key={vehicle.id}
            longitude={display.longitude}
            latitude={display.latitude}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onSelectVehicle(vehicle.id);
            }}
          >
            {/* A moving unit is just the glowing point itself, no attached illustration — a
                short trailing glow (oriented to heading) is the only concession to motion. */}
            <div style={{ position: "relative" }}>
              {moving && (
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: 4,
                    height: size * 1.6,
                    transform: `translate(-50%, -100%) rotate(${display.headingDeg + 180}deg)`,
                    transformOrigin: "50% 100%",
                    background: `linear-gradient(to top, ${color}, transparent)`,
                    opacity: 0.5,
                    borderRadius: 2,
                    pointerEvents: "none",
                  }}
                />
              )}
              <MarkerBadge color={color} size={size} selected={selected} pulse={active} dimmed={hasSelection && !selected} />
            </div>
          </Marker>
        );
      })}
    </>
  );
}
