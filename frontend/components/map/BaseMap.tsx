"use client";

// Reusable base map for EvacRoute. Intentionally minimal: real geography, zoom/pan,
// dark basemap, and correct resize behavior — nothing else. Future layers (roads,
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

// Pittsburgh, PA — default operating area for development.
const DEFAULT_CENTER: [number, number] = [40.4406, -79.9959];
const DEFAULT_ZOOM = 12;

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
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
      />
      {/* Bottom-right so it never collides with the headline KPI overlay pinned to the top. */}
      <ZoomControl position="bottomright" />
      <ResizeObserverBridge />
      {children}
    </MapContainer>
  );
}
