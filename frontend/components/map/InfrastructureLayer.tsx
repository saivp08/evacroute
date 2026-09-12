"use client";

// Fixed infrastructure marker layer: hospitals, shelters (MapLibre).
//   OverviewScreen's poll loop -> this layer (via the `shelters` prop) -> live backend
// Shelters come in as a prop (see IncidentLayer for why); hospitals stay a one-time fetch
// since the backend has no hospital data source at all yet (always empty). The
// destination-shelter set still needs its own poll — it's not part of OverviewScreen's
// existing data shape — so it keeps a real interval here rather than fetching once.
import { useEffect, useState } from "react";
import { Marker, useMap } from "react-map-gl/maplibre";
import type { FacilityStatus, Hospital, Shelter } from "@/lib/models";
import { getHospitals, getRoutes } from "@/lib/services/dataService";
import { useTheme } from "@/lib/theme";
import { getMapPalette } from "@/lib/mapColors";
import { LIVE_POLL_MS } from "@/lib/useLiveEvents";
import MarkerBadge from "./MarkerBadge";

const FACILITY_STATUS_KEY: Record<FacilityStatus, "success" | "caution" | "danger"> = {
  operational: "success",
  limited: "caution",
  offline: "danger",
};

// A shelter's color communicates capacity, not just an open/closed flag — the same
// AVAILABLE/FILLING/NEAR CAPACITY/FULL tiers used in the shelter rail and inspector panel.
// "Closed" here is real FEMA National Shelter System data for a facility that isn't
// currently activated (most of Santa Rosa's 28 real shelters sit dormant day-to-day) — that
// is a neutral, background fact, not an urgent one, so it reads as muted gray rather than
// the same alarming red used for "full."
function shelterCapacityColor(palette: ReturnType<typeof getMapPalette>, shelter: Shelter): string {
  if (shelter.status === "closed") return palette.textMuted;
  const pct = shelter.capacity > 0 ? shelter.occupancy / shelter.capacity : 0;
  if (pct >= 0.95) return palette.danger;
  if (pct >= 0.8) return palette.warning;
  if (pct >= 0.5) return palette.caution;
  return palette.success;
}

interface InfrastructureLayerProps {
  shelters: Shelter[];
  // Fire/police stations have no layer-control toggle, so they stay unconditional (though
  // both currently return no backend data — see dataService); only Hospitals and Shelters
  // are individually togglable (see LayerControlPanel).
  showHospitals?: boolean;
  showShelters?: boolean;
  selectedShelterId?: string | null;
  onSelectShelter?: (id: string) => void;
  hasSelection?: boolean;
}

export default function InfrastructureLayer({
  shelters,
  showHospitals = true,
  showShelters = true,
  selectedShelterId = null,
  onSelectShelter,
  hasSelection,
}: InfrastructureLayerProps) {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  // Shelter ids the optimizer's current plan actually assigns evacuees to (getRoutes()'s
  // destination_shelter_id) — with 28 real FEMA shelters, showing all of them at equal
  // visual weight buries the ones that matter right now.
  const [usedShelterIds, setUsedShelterIds] = useState<Set<string>>(new Set());
  const { current: map } = useMap();
  const { theme } = useTheme();
  const palette = getMapPalette(theme);

  useEffect(() => {
    let cancelled = false;
    getHospitals().then((h) => {
      if (!cancelled) setHospitals(h);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    function poll() {
      getRoutes().then((routes) => {
        if (!cancelled) setUsedShelterIds(new Set(routes.map((r) => r.destination_shelter_id)));
      });
    }
    poll();
    const id = setInterval(poll, LIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!selectedShelterId || !map) return;
    const shelter = shelters.find((s) => s.id === selectedShelterId);
    if (!shelter) return;
    map.flyTo({ center: [shelter.longitude, shelter.latitude], zoom: Math.max(map.getZoom(), 16), duration: 900 });
  }, [selectedShelterId, shelters, map]);

  return (
    <>
      {showHospitals &&
        hospitals.map((hospital) => (
          <Marker key={hospital.id} longitude={hospital.longitude} latitude={hospital.latitude} anchor="center">
            <MarkerBadge color={palette[FACILITY_STATUS_KEY[hospital.status]]} shape="square" size={15} dimmed={hasSelection} />
          </Marker>
        ))}

      {showShelters &&
        shelters.map((shelter) => {
          const selected = shelter.id === selectedShelterId;
          // Unused shelters (no evacuees currently routed there) recede — smaller and
          // faded — rather than competing visually with the ones the plan is actively
          // using, without hiding them (they're still real, still clickable).
          const usedByPlan = usedShelterIds.has(shelter.id) || usedShelterIds.size === 0;
          const size = selected ? 24 : usedByPlan ? 18 : 14;
          const nearCapacity = shelter.capacity > 0 && shelter.occupancy / shelter.capacity >= 0.8;
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
              <div style={{ opacity: selected || usedByPlan ? 1 : 0.75 }}>
                <MarkerBadge
                  color={shelterCapacityColor(palette, shelter)}
                  shape="circle"
                  size={size}
                  selected={selected}
                  pulse={nearCapacity}
                  dimmed={hasSelection && !selected}
                />
              </div>
            </Marker>
          );
        })}
    </>
  );
}
