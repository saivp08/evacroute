"use client";

// Road closure events (MapLibre).
//   OverviewScreen's poll loop -> this layer (via props) -> live backend
// Takes `closures` as a prop (see IncidentLayer for why) rather than fetching its own copy —
// a newly-reported road closure needs to actually appear here, not just in the rail.
import { useEffect } from "react";
import { Marker, Source, Layer, useMap } from "react-map-gl/maplibre";
import type { GeoJSON } from "geojson";
import type { RoadClosure } from "@/lib/models";
import { useTheme } from "@/lib/theme";
import { getMapPalette } from "@/lib/mapColors";
import MarkerBadge from "./MarkerBadge";

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
  closures: RoadClosure[];
  selectedClosureId: string | null;
  onSelectClosure: (id: string) => void;
  hasSelection?: boolean;
}

export default function RoadClosureLayer({ closures, selectedClosureId, onSelectClosure, hasSelection }: RoadClosureLayerProps) {
  const { current: map } = useMap();
  const { theme } = useTheme();
  const palette = getMapPalette(theme);

  useEffect(() => {
    if (!selectedClosureId || !map) return;
    const closure = closures.find((c) => c.id === selectedClosureId);
    if (!closure || closure.coordinates.length === 0) return;
    const [lng, lat] = midpoint(closure.coordinates);
    map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 16), duration: 900 });
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
                {/* Soft red halo underneath the sharp dashed line — the same "illuminated
                    route" native-line-layer technique used for evacuation/response routes,
                    so an affected road reads as visually active, not just a thin line. */}
                {!(hasSelection && !selected) && (
                  <Layer
                    id={`closure-${closure.id}-glow`}
                    type="line"
                    layout={{ "line-cap": "round" }}
                    paint={{
                      "line-color": palette.danger,
                      "line-width": selected ? 18 : 12,
                      "line-blur": selected ? 10 : 7,
                      "line-opacity": selected ? 0.45 : 0.3,
                    }}
                  />
                )}
                <Layer
                  id={`closure-${closure.id}-line`}
                  type="line"
                  layout={{ "line-cap": "round" }}
                  paint={{
                    "line-color": palette.danger,
                    "line-width": selected ? 7 : 5,
                    "line-dasharray": [1, 1.5],
                    "line-opacity": selected ? 1 : hasSelection ? 0.35 : 0.85,
                  }}
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
                  <MarkerBadge color={palette.danger} size={selected ? 20 : 15} selected={selected} pulse dimmed={hasSelection && !selected} />
                  <span className="map-closure-label">{closureLabel(closure)}</span>
                </div>
              </Marker>
            </div>
          );
        })}
    </>
  );
}
