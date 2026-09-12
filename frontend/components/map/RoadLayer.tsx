"use client";

// Road network layer.
//   map component -> this layer -> lib/services/dataService -> mock data (today) / backend (later)
// Uses getRoads(), which existed in the service layer but had no consumer until now — this
// wires it up as the visual road-status layer the console has been missing. Purely visual:
// no routing/pathfinding, just rendering each road's own status.
import { useEffect, useState } from "react";
import { Polyline, Popup } from "react-leaflet";
import type { Road, RoadStatus } from "@/lib/models";
import { getRoads } from "@/lib/services/dataService";

// Four-tier severity ladder using the app's fixed semantic colors: subdued/normal ->
// caution (congested) -> warning (closed) -> danger (actively blocked).
const ROAD_STYLE: Record<RoadStatus, { color: string; weight: number; dashArray?: string; opacity: number; className?: string }> = {
  open: { color: "var(--text-muted)", weight: 3, opacity: 0.55 },
  congested: { color: "var(--caution)", weight: 4, opacity: 0.85 },
  closed: { color: "var(--warning)", weight: 4, dashArray: "1 10", opacity: 0.75 },
  blocked: { color: "var(--danger)", weight: 5, dashArray: "2 8", opacity: 0.95, className: "road-blocked" },
};

export default function RoadLayer() {
  const [roads, setRoads] = useState<Road[]>([]);

  useEffect(() => {
    let cancelled = false;
    getRoads().then((data) => {
      if (!cancelled) setRoads(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {roads.map((road) => (
        <Polyline
          key={road.id}
          positions={road.coordinates.map((p): [number, number] => [p.latitude, p.longitude])}
          pathOptions={ROAD_STYLE[road.status]}
        >
          <Popup>
            <div className="marker-popup">
              <div className="marker-popup-title">{road.name}</div>
              <div className="marker-popup-row">
                <span>Status</span>
                <span>{road.status}</span>
              </div>
              {road.closure_reason && (
                <div className="marker-popup-row">
                  <span>Reason</span>
                  <span>{road.closure_reason}</span>
                </div>
              )}
            </div>
          </Popup>
        </Polyline>
      ))}
    </>
  );
}
