"use client";

// Emergency vehicle marker layer (MapLibre).
//   map component -> this layer -> lib/services/dataService -> live backend
// Selection is lifted to the parent screen (so the Fleet panel and the map stay in sync);
// this layer just reacts to `selectedVehicleId` by flying the camera and enlarging the
// matching marker. No routing/movement is invented here — `vehicle.route` is the backend's
// own dispatch route, drawn and interpolated as-is only when that vehicle is selected.
import { useEffect, useState } from "react";
import { Marker, Source, Layer, useMap } from "react-map-gl/maplibre";
import type { GeoJSON } from "geojson";
import type { LatLng, RouteUpdateEvent, Vehicle, VehicleRoute, VehicleType } from "@/lib/models";
import { getRerouteEvent, getVehicleRoute, getVehicles } from "@/lib/services/dataService";
import { useTickingEta } from "@/lib/useTickingEta";
import { interpolateRoute, truncateRoute } from "@/lib/routeMotion";
import type { RerouteState } from "@/lib/reroute";
import { useTheme } from "@/lib/theme";
import { getMapPalette } from "@/lib/mapColors";
import { useAnimatedLineDash } from "@/lib/useAnimatedLineDash";
import MarkerBadge from "./MarkerBadge";
import { AmbulanceIcon, ClosureIcon, FireEngineIcon, PoliceIcon, RescueIcon } from "./icons";

const RESPONSE_ROUTE_LAYER_ID = "vehicle-selected-route-line";
const ALTERNATE_ROUTE_LAYER_ID = "vehicle-alternate-route-line";

const ACTIVE_STATUSES = new Set(["en_route", "on_scene"]);
// One full pass down the route every 45s — a deliberately unhurried, readable pace.
const CYCLE_MS = 45000;
const TICK_MS = 250;

const VEHICLE_ICON: Record<VehicleType, typeof AmbulanceIcon> = {
  ambulance: AmbulanceIcon,
  fire_engine: FireEngineIcon,
  police_vehicle: PoliceIcon,
  rescue_team: RescueIcon,
};

function toLine(coordinates: LatLng[]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: coordinates.map((p) => [p.longitude, p.latitude]) },
  };
}

interface VehicleLayerProps {
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
  // Only ever set for the currently-selected vehicle — the parent resets it to null
  // whenever selection changes, so this layer doesn't need to re-check the id itself.
  reroute: RerouteState | null;
  // "Emergency Routes" layer toggle: hides just the route/detour lines while vehicle
  // markers themselves stay controlled by the separate "Fleet" toggle.
  showRoutes?: boolean;
}

export default function VehicleLayer({ selectedVehicleId, onSelectVehicle, reroute, showRoutes = true }: VehicleLayerProps) {
  const { current: map } = useMap();
  const { theme } = useTheme();
  const palette = getMapPalette(theme);
  const [fetchedVehicles, setFetchedVehicles] = useState<Vehicle[]>([]);
  const vehicles = useTickingEta(fetchedVehicles);

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
    if (!selectedVehicleId || !map) return;
    const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
    if (!vehicle) return;
    map.flyTo({
      center: [vehicle.longitude, vehicle.latitude],
      zoom: Math.max(map.getZoom(), 16),
      pitch: 55,
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
      {showRoutes && selectedRoute && selectedRoute.coordinates.length > 1 && (
        <Source id="vehicle-selected-route" type="geojson" data={toLine(selectedRoute.coordinates)}>
          <Layer
            id={RESPONSE_ROUTE_LAYER_ID}
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{
              "line-color": rerouteActive ? palette.textMuted : palette.warning,
              "line-width": rerouteActive ? 3 : 5,
              "line-opacity": rerouteActive ? 0.5 : 0.9,
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
          <MarkerBadge color={palette.danger} size={26} pulse>
            <ClosureIcon size={16} color="#fff" />
          </MarkerBadge>
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
        const Icon = VEHICLE_ICON[vehicle.type];
        const active = vehicle.status === "en_route" || vehicle.status === "on_scene";
        const color = active ? palette.emergency : vehicle.status === "available" ? palette.success : palette.textMuted;

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
            <div style={{ transform: moving ? `rotate(${display.headingDeg}deg)` : undefined }}>
              <MarkerBadge color={color} size={selected ? 40 : 30} selected={selected} pulse={active}>
                <Icon size={selected ? 24 : 18} color="#fff" style={{ transform: moving ? `rotate(${-display.headingDeg}deg)` : undefined }} />
              </MarkerBadge>
            </div>
          </Marker>
        );
      })}
    </>
  );
}
