"use client";

import { useEffect, useRef } from "react";
import { Marker, Polyline, Popup, useMap } from "react-leaflet";
import type L from "leaflet";
import type { Vehicle } from "@/lib/models";
import { vehicleIcon } from "./markerIcons";

interface VehicleLayerProps {
  vehicles: Vehicle[];
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
}
export default function VehicleLayer({ vehicles, selectedVehicleId, onSelectVehicle }: VehicleLayerProps) {
  const markerRefs = useRef(new Map<string, L.Marker>());
  const map = useMap();
  useEffect(() => {
    const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
    if (!vehicle) return;
    map.flyTo([vehicle.latitude, vehicle.longitude], Math.max(map.getZoom(), 14), { duration: 0.6 });
    markerRefs.current.get(vehicle.id)?.openPopup();
  }, [selectedVehicleId, vehicles, map]);
  return <>
    {vehicles.filter((v) => v.route.length > 1).map((v) => <Polyline key={`route-${v.id}`}
      positions={v.route.map((p): [number, number] => [p.latitude, p.longitude])}
      pathOptions={{ color: v.type === "rescue_team" ? "#fbbf24" : "#60a5fa", weight: selectedVehicleId === v.id ? 6 : 4, dashArray: "10 8" }}>
      <Popup>{v.callsign}: {v.destination} ({v.eta_minutes} min planned)</Popup>
    </Polyline>)}
    {vehicles.map((v) => <Marker key={v.id} position={[v.latitude, v.longitude]}
      icon={vehicleIcon(v.type, v.status, v.id === selectedVehicleId)}
      ref={(instance) => { if (instance) markerRefs.current.set(v.id, instance); else markerRefs.current.delete(v.id); }}
      eventHandlers={{ click: () => onSelectVehicle(v.id) }}>
      <Popup><div className="marker-popup">
        <div className="marker-popup-title">{v.callsign}</div>
        <div className="marker-popup-sub">{v.type.replaceAll("_", " ")}</div>
        <div className="marker-popup-row"><span>Status</span><span>{v.status.replaceAll("_", " ")}</span></div>
        <div className="marker-popup-row"><span>Destination</span><span>{v.destination ?? "-"}</span></div>
        <div className="marker-popup-row"><span>Planned ETA</span><span>{v.eta_minutes === null ? "-" : `${v.eta_minutes} min`}</span></div>
      </div></Popup>
    </Marker>)}
  </>;
}
