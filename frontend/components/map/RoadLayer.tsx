"use client";

// Road network layer (MapLibre) — a single vector GeoJSON line layer instead of one
// Polyline DOM element per road (the old Leaflet approach), which is what actually lets
// thousands of road segments stay smooth: MapLibre renders the whole layer in one WebGL
// draw call.
//   map component -> this layer -> lib/services/dataService -> live backend
import { useEffect, useMemo, useState } from "react";
import { Source, Layer } from "react-map-gl/maplibre";
import type { GeoJSON } from "geojson";
import type { Road } from "@/lib/models";
import { getRoads } from "@/lib/services/dataService";
import { useTheme } from "@/lib/theme";
import { getMapPalette } from "@/lib/mapColors";

function toFeatureCollection(roads: Road[]): GeoJSON.FeatureCollection<GeoJSON.LineString, { status: string }> {
  return {
    type: "FeatureCollection",
    features: roads.map((road) => ({
      type: "Feature",
      properties: { status: road.status },
      geometry: { type: "LineString", coordinates: road.coordinates.map((p) => [p.longitude, p.latitude]) },
    })),
  };
}

export default function RoadLayer() {
  const [roads, setRoads] = useState<Road[]>([]);
  const { theme } = useTheme();
  const palette = getMapPalette(theme);

  useEffect(() => {
    let cancelled = false;
    getRoads().then((data) => {
      if (!cancelled) setRoads(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const data = useMemo(() => toFeatureCollection(roads), [roads]);

  return (
    <Source id="roads" type="geojson" data={data}>
      {/* Real progressive road-hierarchy: thin/subdued when zoomed out (the "broad
          transportation network" view), thicker and more opaque zoomed in (the
          "individual streets" view) — driven by actual zoom, not a fabricated detail
          layer. MapLibre only allows a "zoom" expression as the direct, top-level input to
          an interpolate/step — it can't be nested inside a "match" — so closed/blocked
          roads get a second always-visible overlay layer instead of a per-status opacity
          branch on this one. */}
      <Layer
        id="roads-line"
        type="line"
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{
          "line-color": ["match", ["get", "status"], "closed", palette.danger, "blocked", palette.danger, "congested", palette.caution, palette.textMuted],
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 14, 1.6, 18, 4],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.35, 16, 0.65],
        }}
      />
      <Layer
        id="roads-closed-overlay"
        type="line"
        filter={["in", ["get", "status"], ["literal", ["closed", "blocked"]]]}
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{
          "line-color": palette.danger,
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.5, 18, 5],
          "line-opacity": 0.95,
        }}
      />
    </Source>
  );
}
