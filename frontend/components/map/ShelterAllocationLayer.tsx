"use client";

// Shelter markers for the dedicated Shelter Allocation page (Phase 9).
//   map component -> this layer -> lib/services/dataService -> deterministic mock data
// Selection is lifted to the parent screen (same pattern as every other map layer in this
// app) so the shelter list panel and the map stay in sync.
import { useEffect, useState } from "react";
import { Marker, Popup, useMap } from "react-leaflet";
import type { ShelterAllocationDetail } from "@/lib/models";
import { getShelterAllocations } from "@/lib/services/dataService";
import { shelterAllocationIcon } from "./markerIcons";

interface ShelterAllocationLayerProps {
  selectedShelterId: string | null;
  onSelectShelter: (id: string) => void;
}

export default function ShelterAllocationLayer({ selectedShelterId, onSelectShelter }: ShelterAllocationLayerProps) {
  const [shelters, setShelters] = useState<ShelterAllocationDetail[]>([]);
  const map = useMap();

  useEffect(() => {
    let cancelled = false;
    getShelterAllocations().then((data) => {
      if (!cancelled) setShelters(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedShelterId) return;
    const shelter = shelters.find((s) => s.id === selectedShelterId);
    if (!shelter) return;
    map.flyTo([shelter.location.latitude, shelter.location.longitude], Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [selectedShelterId, shelters, map]);

  return (
    <>
      {shelters.map((shelter) => {
        const selected = shelter.id === selectedShelterId;
        return (
          <Marker
            key={shelter.id}
            position={[shelter.location.latitude, shelter.location.longitude]}
            icon={shelterAllocationIcon(shelter.status, selected)}
            eventHandlers={{ click: () => onSelectShelter(shelter.id) }}
          >
            <Popup>
              <div className="marker-popup">
                <div className="marker-popup-title">{shelter.name}</div>
                <div className="marker-popup-sub">{shelter.status.replace(/_/g, " ")}</div>
                <div className="marker-popup-row">
                  <span>Available</span>
                  <span>{shelter.available_capacity.toLocaleString()}</span>
                </div>
                <div className="marker-popup-row">
                  <span>Occupied</span>
                  <span>{shelter.current_occupancy.toLocaleString()}</span>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
