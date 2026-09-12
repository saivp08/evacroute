"use client";

// Phase 10 traffic visualization layer.
//   map component -> this layer -> lib/services/dataService -> deterministic mock congestion
// Replaces RoadLayer's plain open/closed styling while toggled on (see OverviewScreen) so
// the same road geometry isn't drawn twice — this is purely a different color/animation
// treatment of the same roads, not a real traffic simulation.
import { useEffect, useState } from "react";
import { Polyline, Popup } from "react-leaflet";
import type { TrafficSegment, TrafficState } from "@/lib/models";
import { getTrafficSegments } from "@/lib/services/dataService";

const TRAFFIC_STYLE: Record<
  TrafficState,
  { color: string; weight: number; opacity: number; dashArray?: string; className?: string }
> = {
  free: { color: "var(--success)", weight: 2, opacity: 0.5 },
  moderate: { color: "var(--caution)", weight: 3, opacity: 0.75, dashArray: "8 10", className: "traffic-flow-moderate" },
  heavy: { color: "var(--warning)", weight: 4, opacity: 0.85, dashArray: "6 8", className: "traffic-flow-heavy" },
  severe: { color: "var(--danger)", weight: 5, opacity: 0.9, dashArray: "4 6", className: "traffic-flow-severe" },
  blocked: { color: "var(--bg-primary)", weight: 6, opacity: 0.95, dashArray: "2 6", className: "traffic-blocked-glow" },
};

// How often the mock congestion subtly reshuffles, so the network reads as "alive" rather
// than a static snapshot — a deterministic function of this counter, not real measurement.
const CYCLE_MS = 12000;

export default function TrafficLayer() {
  const [segments, setSegments] = useState<TrafficSegment[]>([]);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getTrafficSegments(cycle).then((data) => {
      if (!cancelled) setSegments(data);
    });
    return () => {
      cancelled = true;
    };
  }, [cycle]);

  useEffect(() => {
    const id = setInterval(() => setCycle((c) => c + 1), CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      {segments.map((segment) => (
        <Polyline
          key={segment.road_id}
          positions={segment.coordinates.map((p): [number, number] => [p.latitude, p.longitude])}
          pathOptions={TRAFFIC_STYLE[segment.state]}
        >
          <Popup>
            <div className="marker-popup">
              <div className="marker-popup-title">{segment.name}</div>
              <div className="marker-popup-row">
                <span>Traffic</span>
                <span>{segment.state}</span>
              </div>
            </div>
          </Popup>
        </Polyline>
      ))}
    </>
  );
}
