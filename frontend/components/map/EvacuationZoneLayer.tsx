"use client";

// Evacuation zone polygons — real backend zone boundaries (population, geometry, and a
// mandatory/advisory status derived from whether the zone currently has an active
// incident against it; see getEvacuationZones in lib/services/dataService.ts).
//   map component -> this layer -> lib/services/dataService -> live FastAPI backend
// Selection is lifted to the parent screen (same pattern as VehicleLayer/RoadClosureLayer)
// so the zone list panel and the map stay in sync.
import { useEffect, useState } from "react";
import { Polygon, Popup, useMap } from "react-leaflet";
import type { EvacuationZone, EvacuationZoneStatus, LatLng } from "@/lib/models";
import { getEvacuationZones } from "@/lib/services/dataService";

const STATUS_COLOR: Record<EvacuationZoneStatus, string> = {
  mandatory: "var(--danger)",
  warning: "var(--warning)",
  advisory: "var(--caution)",
  clear: "var(--success)",
};

function centroidOf(boundary: LatLng[]): [number, number] | null {
  if (boundary.length === 0) return null;
  const lat = boundary.reduce((sum, p) => sum + p.latitude, 0) / boundary.length;
  const lng = boundary.reduce((sum, p) => sum + p.longitude, 0) / boundary.length;
  return [lat, lng];
}

interface EvacuationZoneLayerProps {
  selectedZoneId: string | null;
  onSelectZone: (id: string) => void;
}

export default function EvacuationZoneLayer({ selectedZoneId, onSelectZone }: EvacuationZoneLayerProps) {
  const [zones, setZones] = useState<EvacuationZone[]>([]);
  const map = useMap();

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
    if (!center) return;
    map.flyTo(center, Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [selectedZoneId, zones, map]);

  return (
    <>
      {zones
        .filter((zone) => zone.boundary.length > 2)
        .map((zone) => {
          const selected = zone.id === selectedZoneId;
          const color = STATUS_COLOR[zone.status];
          return (
            <Polygon
              key={zone.id}
              positions={zone.boundary.map((p): [number, number] => [p.latitude, p.longitude])}
              pathOptions={{
                color,
                weight: selected ? 3 : 1.5,
                fillColor: color,
                fillOpacity: selected ? 0.32 : 0.16,
              }}
              eventHandlers={{ click: () => onSelectZone(zone.id) }}
            >
              <Popup>
                <div className="marker-popup">
                  <div className="marker-popup-title">{zone.name}</div>
                  <div className="marker-popup-sub">{zone.status}</div>
                  <div className="marker-popup-row">
                    <span>Population</span>
                    <span>{zone.population.toLocaleString()}</span>
                  </div>
                </div>
              </Popup>
            </Polygon>
          );
        })}
    </>
  );
}
