"use client";

// Real backend incidents, rendered as clickable map markers (MapLibre).
//   OverviewScreen's poll loop -> this layer (via props) -> live backend
// Takes `incidents` as a prop rather than fetching its own copy — every other layer that
// reacts to a newly-reported incident (RoadClosureLayer, VehicleLayer, InfrastructureLayer)
// does the same, all fed by the same single poll in OverviewScreen. A layer that fetched its
// own copy once on mount would never see a real incident reported after the map first loaded.
import { useEffect } from "react";
import { Marker, useMap } from "react-map-gl/maplibre";
import type { Incident, IncidentSeverity } from "@/lib/models";
import { useTheme } from "@/lib/theme";
import { getMapPalette, type MapPalette } from "@/lib/mapColors";
import MarkerBadge from "./MarkerBadge";

function severityColor(palette: MapPalette, severity: IncidentSeverity): string {
  if (severity === "critical") return palette.danger;
  if (severity === "high") return palette.warning;
  if (severity === "medium") return palette.caution;
  return palette.textMuted;
}

interface IncidentLayerProps {
  incidents: Incident[];
  selectedIncidentId: string | null;
  onSelectIncident: (id: string) => void;
  // True whenever ANY object on the map is selected (not just one in this layer) — GIS-style
  // "dim the unrelated" so the selected object and its own layer's other members recede too.
  hasSelection?: boolean;
}

export default function IncidentLayer({ incidents, selectedIncidentId, onSelectIncident, hasSelection }: IncidentLayerProps) {
  const { current: map } = useMap();
  const { theme } = useTheme();
  const palette = getMapPalette(theme);

  useEffect(() => {
    if (!selectedIncidentId || !map) return;
    const incident = incidents.find((i) => i.id === selectedIncidentId);
    if (!incident) return;
    map.flyTo({ center: [incident.longitude, incident.latitude], zoom: Math.max(map.getZoom(), 16), duration: 900 });
  }, [selectedIncidentId, incidents, map]);

  return (
    <>
      {incidents.map((incident) => {
        const selected = incident.id === selectedIncidentId;
        const color = severityColor(palette, incident.severity);
        const highPriority = incident.severity === "critical" || incident.severity === "high";
        const size = selected ? 22 : 17;
        return (
          <Marker
            key={incident.id}
            longitude={incident.longitude}
            latitude={incident.latitude}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onSelectIncident(incident.id);
            }}
          >
            {/* Expanding detection ring — a real geometric pulse, not a warning-sign
                pictogram. Intensity (opacity via animation, and whether it appears at all)
                scales with severity. */}
            <div style={{ position: "relative", width: size, height: size }}>
              {highPriority && (
                <span
                  className="map-incident-ring"
                  aria-hidden="true"
                  style={{ ["--beacon-color" as string]: color, opacity: incident.severity === "critical" ? 0.9 : 0.6 }}
                />
              )}
              <MarkerBadge color={color} size={size} selected={selected} pulse={incident.severity === "critical"} dimmed={hasSelection && !selected} />
            </div>
          </Marker>
        );
      })}
    </>
  );
}
