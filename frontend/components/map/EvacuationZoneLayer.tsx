"use client";

// Evacuation zone polygons for the dedicated Evacuation Zones page (Phase 8).
//   map component -> this layer -> lib/services/dataService -> deterministic mock data
// Selection is lifted to the parent screen (same pattern as VehicleLayer/RoadClosureLayer)
// so the zone list panel and the map stay in sync. Zones are clickable; the "evacuation
// plan" line (zone centroid -> recommended shelter) is a fixed mock path, not routing.
import { Fragment, useEffect, useState } from "react";
import { Marker, Polygon, Polyline, Popup, useMap } from "react-leaflet";
import type { EvacuationZoneDetail, ZoneEvacuationStatus } from "@/lib/models";
import { getEvacuationZoneDetails } from "@/lib/services/dataService";
import { routeEndpointIcon } from "./markerIcons";

const STATUS_COLOR: Record<ZoneEvacuationStatus, string> = {
  evacuate_now: "var(--danger)",
  evacuation_in_progress: "var(--warning)",
  monitored: "var(--caution)",
  clear: "var(--success)",
};

function centroidLatLng(zone: EvacuationZoneDetail): [number, number] {
  return [zone.centroid.latitude, zone.centroid.longitude];
}

interface EvacuationZoneLayerProps {
  selectedZoneId: string | null;
  onSelectZone: (id: string) => void;
  planVisible: boolean;
}

export default function EvacuationZoneLayer({ selectedZoneId, onSelectZone, planVisible }: EvacuationZoneLayerProps) {
  const [zones, setZones] = useState<EvacuationZoneDetail[]>([]);
  const map = useMap();

  useEffect(() => {
    let cancelled = false;
    getEvacuationZoneDetails().then((data) => {
      if (!cancelled) setZones(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedZoneId) return;
    const zone = zones.find((z) => z.id === selectedZoneId);
    if (!zone) return;
    map.flyTo(centroidLatLng(zone), Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [selectedZoneId, zones, map]);

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null;

  return (
    <>
      {zones.map((zone) => {
        const selected = zone.id === selectedZoneId;
        const color = STATUS_COLOR[zone.status];
        return (
          <Fragment key={zone.id}>
            <Polygon
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
                  <div className="marker-popup-sub">{zone.status.replace(/_/g, " ")}</div>
                  <div className="marker-popup-row">
                    <span>Population</span>
                    <span>{zone.population.toLocaleString()}</span>
                  </div>
                  <div className="marker-popup-row">
                    <span>Evacuated</span>
                    <span>{zone.evacuated_percent}%</span>
                  </div>
                </div>
              </Popup>
            </Polygon>
          </Fragment>
        );
      })}

      {planVisible && selectedZone && (
        <>
          <Polyline
            positions={[
              centroidLatLng(selectedZone),
              [selectedZone.shelter_location.latitude, selectedZone.shelter_location.longitude],
            ]}
            pathOptions={{ color: "var(--active)", weight: 4, dashArray: "10 8", className: "route-flow" }}
          />
          <Marker
            position={[selectedZone.shelter_location.latitude, selectedZone.shelter_location.longitude]}
            icon={routeEndpointIcon("destination")}
          >
            <Popup>
              <div className="marker-popup">
                <div className="marker-popup-title">{selectedZone.recommended_shelter_name}</div>
                <div className="marker-popup-sub">Recommended shelter</div>
              </div>
            </Popup>
          </Marker>
        </>
      )}
    </>
  );
}
