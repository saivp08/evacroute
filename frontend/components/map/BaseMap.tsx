"use client";

// Reusable base map for EvacRoute. Intentionally minimal: real geography, zoom/pan, a
// light desaturated basemap (matching the editorial civic-tech design system — see
// globals.css), and correct resize behavior — nothing else. Future layers (roads,
// vehicles, hospitals, shelters, hazards, evacuation zones, routes, closures,
// congestion, population, fire detections) will be added as sibling children/props
// later; this component is the shell they will render into.
import "leaflet/dist/leaflet.css";
import { useEffect, type ReactNode } from "react";
import { MapContainer, TileLayer, ZoomControl, useMap } from "react-leaflet";

export interface BaseMapProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  children?: ReactNode;
}

// Santa Rosa, CA — the live backend's scenario area (see backend/app/models/scenario.py).
const DEFAULT_CENTER: [number, number] = [38.4404, -122.7141];
const DEFAULT_ZOOM = 14;

function ResizeObserverBridge() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

export default function BaseMap({ center = DEFAULT_CENTER, zoom = DEFAULT_ZOOM, className, children }: BaseMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      minZoom={3}
      maxZoom={18}
      className={className ?? "base-map"}
      zoomControl={false}
    >
      <TileLayer
        attribution='Tiles &copy; Esri &mdash; Esri, HERE, Garmin, OpenStreetMap contributors'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
      />
      {/* Bottom-right so it never collides with the headline KPI overlay pinned to the top. */}
      <ZoomControl position="bottomright" />
      <ResizeObserverBridge />
      {children}
    </MapContainer>
  );
}
