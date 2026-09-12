"use client";

// Hazard zone layer (Phase 10 map-layer toggle).
//   map component -> this layer -> lib/services/dataService -> deterministic mock data
import { useEffect, useState } from "react";
import { Circle, Popup } from "react-leaflet";
import type { Hazard, IncidentSeverity } from "@/lib/models";
import { getHazards } from "@/lib/services/dataService";

const SEVERITY_COLOR: Record<IncidentSeverity, string> = {
  critical: "var(--danger)",
  high: "var(--warning)",
  medium: "var(--caution)",
  low: "var(--text-muted)",
};

export default function HazardLayer() {
  const [hazards, setHazards] = useState<Hazard[]>([]);

  useEffect(() => {
    let cancelled = false;
    getHazards().then((data) => {
      if (!cancelled) setHazards(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {hazards.map((hazard) => {
        const color = SEVERITY_COLOR[hazard.severity];
        return (
          <Circle
            key={hazard.id}
            center={[hazard.latitude, hazard.longitude]}
            radius={hazard.radius_meters}
            pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.15, className: "hazard-pulse" }}
          >
            <Popup>
              <div className="marker-popup">
                <div className="marker-popup-title">{hazard.name}</div>
                <div className="marker-popup-sub">{hazard.type.replace(/_/g, " ")}</div>
                <div className="marker-popup-row">
                  <span>Severity</span>
                  <span>{hazard.severity}</span>
                </div>
              </div>
            </Popup>
          </Circle>
        );
      })}
    </>
  );
}
