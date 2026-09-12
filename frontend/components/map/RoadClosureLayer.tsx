"use client";

// Road closure events (MapLibre).
//   map component -> this layer -> lib/services/dataService -> live backend
// Purely a visual/event layer: no route avoidance or automatic rerouting is computed from
// a closure existing here. Selection is lifted to the parent screen so the Road Closures
// panel and the map stay in sync, the same pattern every layer uses.
import { useEffect, useState } from "react";
import { Marker, Source, Layer, useMap } from "react-map-gl/maplibre";
import type { GeoJSON } from "geojson";
import type { RoadClosure } from "@/lib/models";
import { getRoadClosures } from "@/lib/services/dataService";
import { useTheme } from "@/lib/theme";
import { getMapPalette } from "@/lib/mapColors";
import MarkerBadge from "./MarkerBadge";
import { ClosureIcon } from "./icons";

function midpoint(coordinates: RoadClosure["coordinates"]): [number, number] {
  const mid = coordinates[Math.floor((coordinates.length - 1) / 2)];
  return [mid.longitude, mid.latitude];
}

// A short, real-data-driven label rather than a generic "Closure" — read straight off the
// backend's own incident type/reason text, not invented copy.
function closureLabel(closure: RoadClosure): string {
  const reason = closure.reason.toLowerCase();
  if (reason.includes("debris")) return "DEBRIS";
  if (reason.includes("damage")) return "ROAD DAMAGE";
  if (reason.includes("hazard")) return "HAZARD";
  return "ROAD CLOSED";
}

function toLine(closure: RoadClosure): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    properties: { id: closure.id },
    geometry: { type: "LineString", coordinates: closure.coordinates.map((p) => [p.longitude, p.latitude]) },
  };
}

interface RoadClosureLayerProps {
  selectedClosureId: string | null;
  onSelectClosure: (id: string) => void;
}

export default function RoadClosureLayer({ selectedClosureId, onSelectClosure }: RoadClosureLayerProps) {
  const [closures, setClosures] = useState<RoadClosure[]>([]);
  const { current: map } = useMap();
  const { theme } = useTheme();
  const palette = getMapPalette(theme);

  useEffect(() => {
    let cancelled = false;
    getRoadClosures().then((data) => {
      if (!cancelled) setClosures(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedClosureId || !map) return;
    const closure = closures.find((c) => c.id === selectedClosureId);
    if (!closure || closure.coordinates.length === 0) return;
    const [lng, lat] = midpoint(closure.coordinates);
    map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 16), pitch: 55, duration: 900 });
  }, [selectedClosureId, closures, map]);

  return (
    <>
      {closures
        .filter((closure) => closure.coordinates.length > 1)
        .map((closure) => {
          const selected = closure.id === selectedClosureId;
          const [lng, lat] = midpoint(closure.coordinates);
          return (
            <div key={closure.id}>
              <Source id={`closure-${closure.id}`} type="geojson" data={toLine(closure)}>
                <Layer
                  id={`closure-${closure.id}-line`}
                  type="line"
                  layout={{ "line-cap": "round" }}
                  paint={{ "line-color": palette.danger, "line-width": selected ? 7 : 5, "line-dasharray": [1, 1.5], "line-opacity": selected ? 1 : 0.85 }}
                />
              </Source>
              <Marker
                longitude={lng}
                latitude={lat}
                anchor="center"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  onSelectClosure(closure.id);
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <MarkerBadge color={palette.danger} size={selected ? 34 : 24} selected={selected} pulse>
                    <ClosureIcon size={selected ? 20 : 14} color="#fff" />
                  </MarkerBadge>
                  <span className="map-closure-label">{closureLabel(closure)}</span>
                </div>
              </Marker>
            </div>
          );
        })}
    </>
  );
}
