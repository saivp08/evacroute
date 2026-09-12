"use client";

import { Polyline, Popup } from "react-leaflet";
import type { Road, RoadStatus } from "@/lib/models";

const ROAD_STYLE: Record<RoadStatus, { color: string; weight: number; dashArray?: string; opacity: number; className?: string }> = {
  open: { color: "#64748b", weight: 3, opacity: 0.55 },
  restricted: { color: "var(--status-caution)", weight: 4, opacity: 0.85 },
  congested: { color: "var(--status-caution)", weight: 4, opacity: 0.85 },
  blocked: { color: "var(--status-critical)", weight: 5, dashArray: "2 8", opacity: 0.95, className: "road-blocked" },
  closed: { color: "var(--status-critical)", weight: 4, dashArray: "1 10", opacity: 0.7 },
};

export default function RoadLayer({ roads }: { roads: Road[] }) {
  return (
    <>
      {roads.map((road) => (
        <Polyline
          key={`${road.id}-${road.status}`}
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
