"use client";

// Evacuation zone polygons (MapLibre) — real backend zone boundaries, population, and a
// mandatory/advisory status derived from whether the zone currently has an active incident
// against it (see getEvacuationZones in lib/services/dataService.ts).
import { useEffect, useState } from "react";
import { Source, Layer, useMap } from "react-map-gl/maplibre";
import type { GeoJSON } from "geojson";
import type { MapMouseEvent } from "maplibre-gl";
import type { EvacuationZone, EvacuationZoneStatus, LatLng } from "@/lib/models";
import { getEvacuationZones } from "@/lib/services/dataService";
import { useTheme } from "@/lib/theme";
import { getMapPalette, type MapPalette } from "@/lib/mapColors";

function statusColor(palette: MapPalette, status: EvacuationZoneStatus): string {
  if (status === "mandatory") return palette.danger;
  if (status === "warning") return palette.warning;
  if (status === "advisory") return palette.caution;
  return palette.success;
}

function centroidOf(boundary: LatLng[]): [number, number] | null {
  if (boundary.length === 0) return null;
  const lat = boundary.reduce((sum, p) => sum + p.latitude, 0) / boundary.length;
  const lng = boundary.reduce((sum, p) => sum + p.longitude, 0) / boundary.length;
  return [lng, lat];
}

// A short "ZONE A"-style code from the zone's own id (e.g. "zone-a" -> "ZONE A") rather
// than a generic label, so it stays tied to the real backend identifier.
function zoneCode(zoneId: string): string {
  const letter = zoneId.split("-").pop() ?? "";
  return `ZONE ${letter.toUpperCase()}`;
}

function toFeatureCollection(
  zones: EvacuationZone[],
  palette: MapPalette
): GeoJSON.FeatureCollection<GeoJSON.Polygon, { id: string; color: string; code: string }> {
  return {
    type: "FeatureCollection",
    features: zones
      .filter((zone) => zone.boundary.length > 2)
      .map((zone) => ({
        type: "Feature",
        properties: { id: zone.id, color: statusColor(palette, zone.status), code: zoneCode(zone.id) },
        geometry: { type: "Polygon", coordinates: [[...zone.boundary.map((p): [number, number] => [p.longitude, p.latitude]), [zone.boundary[0].longitude, zone.boundary[0].latitude]]] },
      })),
  };
}

interface EvacuationZoneLayerProps {
  selectedZoneId: string | null;
  onSelectZone: (id: string) => void;
}

export default function EvacuationZoneLayer({ selectedZoneId, onSelectZone }: EvacuationZoneLayerProps) {
  const [zones, setZones] = useState<EvacuationZone[]>([]);
  const { current: map } = useMap();
  const { theme } = useTheme();
  const palette = getMapPalette(theme);

  useEffect(() => {
    let cancelled = false;
    getEvacuationZones().then((data) => {
      if (!cancelled) setZones(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedZoneId) return;
    const zone = zones.find((z) => z.id === selectedZoneId);
    const center = zone ? centroidOf(zone.boundary) : null;
    if (!center || !map) return;
    map.flyTo({ center, zoom: Math.max(map.getZoom(), 14), pitch: 45, duration: 900 });
  }, [selectedZoneId, zones, map]);

  useEffect(() => {
    if (!map) return;
    const handleClick = (e: MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ["evac-zones-fill"] });
      const id = features[0]?.properties?.id;
      if (typeof id === "string") onSelectZone(id);
    };
    map.on("click", "evac-zones-fill", handleClick);
    return () => {
      map.off("click", "evac-zones-fill", handleClick);
    };
  }, [map, onSelectZone]);

  const data = toFeatureCollection(zones, palette);
  const selectedZone = zones.find((z) => z.id === selectedZoneId);

  return (
    <Source id="evac-zones" type="geojson" data={data}>
      <Layer
        id="evac-zones-fill"
        type="fill"
        paint={{
          "fill-color": ["get", "color"],
          "fill-opacity": ["case", ["==", ["get", "id"], selectedZone?.id ?? ""], 0.35, 0.16],
        }}
      />
      <Layer
        id="evac-zones-outline"
        type="line"
        paint={{
          "line-color": ["get", "color"],
          "line-width": ["case", ["==", ["get", "id"], selectedZone?.id ?? ""], 3, 1.5],
        }}
      />
      <Layer
        id="evac-zones-label"
        type="symbol"
        layout={{
          "text-field": ["get", "code"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 13,
          "symbol-placement": "point",
        }}
        paint={{ "text-color": ["get", "color"], "text-halo-color": "#ffffff", "text-halo-width": 1.4 }}
      />
    </Source>
  );
}
