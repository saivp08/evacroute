"use client";

// Fixed infrastructure marker layer: hospitals, shelters (MapLibre).
//   map component -> this layer -> lib/services/dataService -> live backend (shelters) /
//   empty (hospitals — no backend data source exists yet, see dataService.getHospitals)
import { useEffect, useState } from "react";
import { Marker, useMap } from "react-map-gl/maplibre";
import type { FacilityStatus, Hospital, Shelter, ShelterStatus } from "@/lib/models";
import { getHospitals, getShelters } from "@/lib/services/dataService";
import { useTheme } from "@/lib/theme";
import { getMapPalette } from "@/lib/mapColors";
import MarkerBadge from "./MarkerBadge";
import { HospitalIcon, ShelterIcon } from "./icons";

const FACILITY_STATUS_KEY: Record<FacilityStatus, "success" | "caution" | "danger"> = {
  operational: "success",
  limited: "caution",
  offline: "danger",
};

const SHELTER_STATUS_KEY: Record<ShelterStatus, "success" | "warning" | "danger"> = {
  open: "success",
  full: "warning",
  closed: "danger",
};

interface InfrastructureLayerProps {
  // Fire/police stations have no layer-control toggle, so they stay unconditional (though
  // both currently return no backend data — see dataService); only Hospitals and Shelters
  // are individually togglable (see LayerControlPanel).
  showHospitals?: boolean;
  showShelters?: boolean;
  selectedShelterId?: string | null;
  onSelectShelter?: (id: string) => void;
}

export default function InfrastructureLayer({
  showHospitals = true,
  showShelters = true,
  selectedShelterId = null,
  onSelectShelter,
}: InfrastructureLayerProps) {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const { current: map } = useMap();
  const { theme } = useTheme();
  const palette = getMapPalette(theme);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getHospitals(), getShelters()]).then(([h, s]) => {
      if (cancelled) return;
      setHospitals(h);
      setShelters(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedShelterId || !map) return;
    const shelter = shelters.find((s) => s.id === selectedShelterId);
    if (!shelter) return;
    map.flyTo({ center: [shelter.longitude, shelter.latitude], zoom: Math.max(map.getZoom(), 16), pitch: 50, duration: 900 });
  }, [selectedShelterId, shelters, map]);

  return (
    <>
      {showHospitals &&
        hospitals.map((hospital) => (
          <Marker key={hospital.id} longitude={hospital.longitude} latitude={hospital.latitude} anchor="center">
            <MarkerBadge color={palette[FACILITY_STATUS_KEY[hospital.status]]} shape="square" size={28}>
              <HospitalIcon size={17} color="#fff" />
            </MarkerBadge>
          </Marker>
        ))}

      {showShelters &&
        shelters.map((shelter) => {
          const selected = shelter.id === selectedShelterId;
          return (
            <Marker
              key={shelter.id}
              longitude={shelter.longitude}
              latitude={shelter.latitude}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onSelectShelter?.(shelter.id);
              }}
            >
              <MarkerBadge color={palette[SHELTER_STATUS_KEY[shelter.status]]} shape="square" size={selected ? 36 : 28} selected={selected}>
                <ShelterIcon size={selected ? 21 : 17} color="#fff" />
              </MarkerBadge>
            </Marker>
          );
        })}
    </>
  );
}
