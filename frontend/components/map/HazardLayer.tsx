"use client";

// Hazard zone layer (MapLibre) — currently always empty because the live backend has no
// hazard concept (see getHazards in lib/services/dataService.ts); wired up for real
// geometry the moment that data exists rather than inventing any now.
import { useEffect, useState } from "react";
import { Source, Layer } from "react-map-gl/maplibre";
import type { GeoJSON } from "geojson";
import type { Hazard, IncidentSeverity } from "@/lib/models";
import { getHazards } from "@/lib/services/dataService";
import { useTheme } from "@/lib/theme";
import { getMapPalette, type MapPalette } from "@/lib/mapColors";

function severityColor(palette: MapPalette, severity: IncidentSeverity): string {
  if (severity === "critical") return palette.danger;
  if (severity === "high") return palette.warning;
  if (severity === "medium") return palette.caution;
  return palette.textMuted;
}

// Real geographic circle (not a fixed-pixel radius) around a hazard center, so its
// footprint scales correctly with the map's geography at every zoom level.
function circlePolygon(lat: number, lng: number, radiusMeters: number, steps = 48): [number, number][] {
  const coords: [number, number][] = [];
  const earthRadius = 6371000;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat = (radiusMeters * Math.cos(angle)) / earthRadius;
    const dLng = (radiusMeters * Math.sin(angle)) / (earthRadius * Math.cos((lat * Math.PI) / 180));
    coords.push([lng + (dLng * 180) / Math.PI, lat + (dLat * 180) / Math.PI]);
  }
  return coords;
}

function toFeatureCollection(hazards: Hazard[], palette: MapPalette): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: hazards.map((hazard) => ({
      type: "Feature",
      properties: { color: severityColor(palette, hazard.severity), name: hazard.name },
      geometry: { type: "Polygon", coordinates: [circlePolygon(hazard.latitude, hazard.longitude, hazard.radius_meters)] },
    })),
  };
}

export default function HazardLayer() {
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const { theme } = useTheme();
  const palette = getMapPalette(theme);

  useEffect(() => {
    let cancelled = false;
    getHazards().then((data) => {
      if (!cancelled) setHazards(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (hazards.length === 0) return null;

  return (
    <Source id="hazards" type="geojson" data={toFeatureCollection(hazards, palette)}>
      <Layer id="hazards-fill" type="fill" paint={{ "fill-color": ["get", "color"], "fill-opacity": 0.2 }} />
      <Layer id="hazards-outline" type="line" paint={{ "line-color": ["get", "color"], "line-width": 2 }} />
    </Source>
  );
}
