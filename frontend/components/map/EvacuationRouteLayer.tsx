"use client";

// Civilian evacuation flow: zone -> shelter routes from the backend's own optimizer
// (getRoutes(), backed by /optimize's evacuation_routes) — this had no map presence at all
// before; only the selected vehicle's dispatch route was drawn. Renders as an animated
// teal/cyan directional line (see lib/useAnimatedLineDash.ts) distinct from emergency
// response routes (VehicleLayer, amber).
//
// Before/after replanning: routes are keyed by zone id, not the backend's route id, because
// a re-optimized zone can be reassigned to a different shelter (a new route id) after a
// closure — the OLD polyline for that zone is what needs to visibly linger and fade, not a
// stale id lookup. When a zone's route geometry changes between polls, the previous
// coordinates are kept as a thin dashed gray "ghost" for GHOST_MS before being dropped —
// real backend before/after, not a fabricated transition.
import { useEffect, useRef, useState } from "react";
import { Source, Layer, useMap } from "react-map-gl/maplibre";
import type { GeoJSON } from "geojson";
import type { LatLng, Route } from "@/lib/models";
import { getRoutes } from "@/lib/services/dataService";
import { invalidateBackendState } from "@/lib/services/backendClient";
import { useTheme } from "@/lib/theme";
import { getMapPalette } from "@/lib/mapColors";
import { useAnimatedLineDash } from "@/lib/useAnimatedLineDash";
import { LIVE_POLL_MS } from "@/lib/useLiveEvents";

const GHOST_MS = 2600;
const ROUTE_LAYER_ID = "evac-route-line";
const ROUTE_GLOW_LAYER_ID = "evac-route-glow";

function toLine(coordinates: LatLng[]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: coordinates.map((p) => [p.longitude, p.latitude]) },
  };
}

function toMultiLine(routes: Route[]): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return {
    type: "FeatureCollection",
    features: routes.filter((r) => r.coordinates.length > 1).map((r) => toLine(r.coordinates)),
  };
}

function sameGeometry(a: LatLng[], b: LatLng[]): boolean {
  if (a.length !== b.length) return false;
  const step = Math.max(1, Math.floor(a.length / 6));
  for (let i = 0; i < a.length; i += step) {
    if (a[i].latitude !== b[i].latitude || a[i].longitude !== b[i].longitude) return false;
  }
  return true;
}

interface GhostRoute {
  zoneId: string;
  coordinates: LatLng[];
}

export default function EvacuationRouteLayer() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [ghosts, setGhosts] = useState<GhostRoute[]>([]);
  const prevByZone = useRef<Map<string, LatLng[]>>(new Map());
  const { current: map } = useMap();
  const { theme } = useTheme();
  const palette = getMapPalette(theme);

  useEffect(() => {
    let cancelled = false;

    function poll() {
      invalidateBackendState();
      getRoutes().then((data) => {
        if (cancelled) return;

        const nextByZone = new Map<string, LatLng[]>();
        for (const route of data) {
          if (route.coordinates.length > 1) nextByZone.set(route.origin_zone_id, route.coordinates);
        }

        const newGhosts: GhostRoute[] = [];
        for (const [zoneId, prevCoords] of prevByZone.current) {
          const nextCoords = nextByZone.get(zoneId);
          if (nextCoords && !sameGeometry(prevCoords, nextCoords)) {
            newGhosts.push({ zoneId, coordinates: prevCoords });
          }
        }
        if (newGhosts.length > 0) {
          setGhosts((current) => [...current, ...newGhosts]);
          for (const ghost of newGhosts) {
            setTimeout(() => {
              setGhosts((current) => current.filter((g) => g !== ghost));
            }, GHOST_MS);
          }
        }

        prevByZone.current = nextByZone;
        setRoutes(data);
      });
    }

    poll();
    const id = setInterval(poll, LIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useAnimatedLineDash(map, routes.length > 0 ? [ROUTE_LAYER_ID] : []);

  return (
    <>
      {ghosts.map((ghost, index) => (
        <Source key={`${ghost.zoneId}-${index}`} id={`evac-ghost-${ghost.zoneId}-${index}`} type="geojson" data={toLine(ghost.coordinates)}>
          <Layer
            id={`evac-ghost-${ghost.zoneId}-${index}-line`}
            type="line"
            layout={{ "line-cap": "round" }}
            paint={{ "line-color": palette.textMuted, "line-width": 2.5, "line-dasharray": [2, 2], "line-opacity": 0.7 }}
          />
        </Source>
      ))}

      {routes.length > 0 && (
        <Source id="evac-routes" type="geojson" data={toMultiLine(routes)}>
          <Layer
            id={ROUTE_GLOW_LAYER_ID}
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": palette.active, "line-width": 13, "line-blur": 7, "line-opacity": 0.3 }}
          />
          <Layer
            id={ROUTE_LAYER_ID}
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": palette.active, "line-width": 4.5, "line-opacity": 0.9 }}
          />
        </Source>
      )}
    </>
  );
}
