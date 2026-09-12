"use client";

// Real backend incidents, rendered as clickable map markers.
//   map component -> this layer -> lib/services/dataService -> live FastAPI backend
// Selection is lifted to the parent screen (same pattern as every other layer) so the
// Active Incidents panel and the map stay in sync.
import { useEffect, useState } from "react";
import { Marker, Popup, useMap } from "react-leaflet";
import type { Incident } from "@/lib/models";
import { getIncidents } from "@/lib/services/dataService";
import { incidentIcon } from "./markerIcons";

interface IncidentLayerProps {
  selectedIncidentId: string | null;
  onSelectIncident: (id: string) => void;
}

export default function IncidentLayer({ selectedIncidentId, onSelectIncident }: IncidentLayerProps) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const map = useMap();

  useEffect(() => {
    let cancelled = false;
    getIncidents().then((data) => {
      if (!cancelled) setIncidents(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedIncidentId) return;
    const incident = incidents.find((i) => i.id === selectedIncidentId);
    if (!incident) return;
    map.flyTo([incident.latitude, incident.longitude], Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [selectedIncidentId, incidents, map]);

  return (
    <>
      {incidents.map((incident) => {
        const selected = incident.id === selectedIncidentId;
        return (
          <Marker
            key={incident.id}
            position={[incident.latitude, incident.longitude]}
            icon={incidentIcon(incident.severity, selected)}
            eventHandlers={{ click: () => onSelectIncident(incident.id) }}
          >
            <Popup>
              <div className="marker-popup">
                <div className="marker-popup-title">{incident.type.replace(/_/g, " ")}</div>
                <div className="marker-popup-sub">{incident.severity} severity</div>
                <div className="marker-popup-row">
                  <span>Status</span>
                  <span>{incident.status}</span>
                </div>
                <div className="marker-popup-row">
                  <span>Zone</span>
                  <span>{incident.zone_id ?? "—"}</span>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
