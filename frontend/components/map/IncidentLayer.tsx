"use client";

// Real backend incidents, rendered as clickable map markers (MapLibre).
//   map component -> this layer -> lib/services/dataService -> live backend
import { useEffect, useState } from "react";
import { Marker, useMap } from "react-map-gl/maplibre";
import type { Incident, IncidentSeverity } from "@/lib/models";
import { getIncidents } from "@/lib/services/dataService";
import { useTheme } from "@/lib/theme";
import { getMapPalette, type MapPalette } from "@/lib/mapColors";
import MarkerBadge from "./MarkerBadge";
import { IncidentIcon } from "./icons";

function severityColor(palette: MapPalette, severity: IncidentSeverity): string {
  if (severity === "critical") return palette.danger;
  if (severity === "high") return palette.warning;
  if (severity === "medium") return palette.caution;
  return palette.textMuted;
}

interface IncidentLayerProps {
  selectedIncidentId: string | null;
  onSelectIncident: (id: string) => void;
}

export default function IncidentLayer({ selectedIncidentId, onSelectIncident }: IncidentLayerProps) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const { current: map } = useMap();
  const { theme } = useTheme();
  const palette = getMapPalette(theme);

  useEffect(() => {
    let cancelled = false;
    getIncidents().then((data) => {
      if (!cancelled) setIncidents(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedIncidentId || !map) return;
    const incident = incidents.find((i) => i.id === selectedIncidentId);
    if (!incident) return;
    map.flyTo({ center: [incident.longitude, incident.latitude], zoom: Math.max(map.getZoom(), 16), pitch: 55, duration: 900 });
  }, [selectedIncidentId, incidents, map]);

  return (
    <>
      {incidents.map((incident) => {
        const selected = incident.id === selectedIncidentId;
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
            <MarkerBadge
              color={severityColor(palette, incident.severity)}
              size={selected ? 38 : 28}
              selected={selected}
              pulse={incident.severity === "critical"}
            >
              <IncidentIcon size={selected ? 22 : 16} color="#fff" />
            </MarkerBadge>
          </Marker>
        );
      })}
    </>
  );
}
