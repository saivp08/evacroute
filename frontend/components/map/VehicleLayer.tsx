"use client";

// Emergency vehicle marker layer.
//   map component -> this layer -> lib/services/dataService -> mock data (today) / backend (later)
// Selection is lifted to the parent screen (so the Fleet panel and the map stay in sync);
// this layer just reacts to `selectedVehicleId` by centering the map and highlighting the
// matching marker. No routing is computed here — `vehicle.route` is a fixed mock path,
// drawn as-is only when that vehicle is selected.
import { useEffect, useRef, useState } from "react";
import { Marker, Polyline, Popup, useMap } from "react-leaflet";
import type L from "leaflet";
import type { Vehicle } from "@/lib/models";
import { getVehicles } from "@/lib/services/dataService";
import { useTickingEta } from "@/lib/useTickingEta";
import { vehicleIcon } from "./markerIcons";

interface VehicleLayerProps {
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
}

export default function VehicleLayer({ selectedVehicleId, onSelectVehicle }: VehicleLayerProps) {
  const [fetchedVehicles, setFetchedVehicles] = useState<Vehicle[]>([]);
  const vehicles = useTickingEta(fetchedVehicles);
  const markerRefs = useRef(new Map<string, L.Marker>());
  const map = useMap();

  useEffect(() => {
    let cancelled = false;
    getVehicles().then((data) => {
      if (!cancelled) setFetchedVehicles(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedVehicleId) return;
    const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
    if (!vehicle) return;
    map.flyTo([vehicle.latitude, vehicle.longitude], Math.max(map.getZoom(), 14), { duration: 0.6 });
    markerRefs.current.get(vehicle.id)?.openPopup();
  }, [selectedVehicleId, vehicles, map]);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);

  return (
    <>
      {selectedVehicle && selectedVehicle.route.length > 1 && (
        <Polyline
          positions={selectedVehicle.route.map((p): [number, number] => [p.latitude, p.longitude])}
          pathOptions={{ color: "var(--status-response)", weight: 4, dashArray: "10 8", className: "route-flow" }}
        />
      )}

      {vehicles.map((vehicle) => {
        const selected = vehicle.id === selectedVehicleId;
        return (
          <Marker
            key={vehicle.id}
            position={[vehicle.latitude, vehicle.longitude]}
            icon={vehicleIcon(vehicle.type, vehicle.status, selected)}
            ref={(instance) => {
              if (instance) markerRefs.current.set(vehicle.id, instance);
              else markerRefs.current.delete(vehicle.id);
            }}
            eventHandlers={{ click: () => onSelectVehicle(vehicle.id) }}
          >
            <Popup>
              <div className="marker-popup">
                <div className="marker-popup-title">{vehicle.callsign}</div>
                <div className="marker-popup-sub">{vehicle.type.replace(/_/g, " ")}</div>
                <div className="marker-popup-row">
                  <span>Status</span>
                  <span>{vehicle.status.replace(/_/g, " ")}</span>
                </div>
                <div className="marker-popup-row">
                  <span>Destination</span>
                  <span>{vehicle.destination ?? "—"}</span>
                </div>
                <div className="marker-popup-row">
                  <span>ETA</span>
                  <span>{vehicle.eta_minutes !== null ? `${vehicle.eta_minutes} min` : "—"}</span>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
