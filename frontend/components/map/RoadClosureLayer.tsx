"use client";

// Road closure events.
//   map component -> this layer -> lib/services/dataService -> mock data (today) / backend (later)
// Purely a visual/event layer: no route avoidance or automatic rerouting is computed from
// a closure existing here. Selection is lifted to the parent screen so the Road Closures
// panel and the map stay in sync, the same pattern VehicleLayer uses for vehicles.
import { Fragment, useEffect, useState } from "react";
import { Marker, Polyline, Popup, useMap } from "react-leaflet";
import type { RoadClosure } from "@/lib/models";
import { getRoadClosures } from "@/lib/services/dataService";
import { roadClosureIcon } from "./markerIcons";

function midpoint(coordinates: RoadClosure["coordinates"]): [number, number] {
  const mid = coordinates[Math.floor((coordinates.length - 1) / 2)];
  return [mid.latitude, mid.longitude];
}

interface RoadClosureLayerProps {
  selectedClosureId: string | null;
  onSelectClosure: (id: string) => void;
}

export default function RoadClosureLayer({ selectedClosureId, onSelectClosure }: RoadClosureLayerProps) {
  const [closures, setClosures] = useState<RoadClosure[]>([]);
  const map = useMap();

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
    if (!selectedClosureId) return;
    const closure = closures.find((c) => c.id === selectedClosureId);
    if (!closure) return;
    map.flyTo(midpoint(closure.coordinates), Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [selectedClosureId, closures, map]);

  return (
    <>
      {closures.map((closure) => {
        const selected = closure.id === selectedClosureId;
        return (
          <Fragment key={closure.id}>
            <Polyline
              positions={closure.coordinates.map((p): [number, number] => [p.latitude, p.longitude])}
              pathOptions={{
                color: "var(--danger)",
                weight: selected ? 7 : 5,
                dashArray: "2 8",
                opacity: selected ? 1 : 0.85,
                className: "road-blocked",
              }}
              eventHandlers={{ click: () => onSelectClosure(closure.id) }}
            />
            <Marker
              position={midpoint(closure.coordinates)}
              icon={roadClosureIcon(selected)}
              eventHandlers={{ click: () => onSelectClosure(closure.id) }}
            >
              <Popup>
                <div className="marker-popup">
                  <div className="marker-popup-title">{closure.road_name}</div>
                  <div className="marker-popup-sub">{closure.reason}</div>
                  <div className="marker-popup-row">
                    <span>Severity</span>
                    <span>{closure.severity}</span>
                  </div>
                  <div className="marker-popup-row">
                    <span>Status</span>
                    <span>{closure.status}</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
    </>
  );
}
