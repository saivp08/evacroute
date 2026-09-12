"use client";

// Phase 9 — dedicated, map-first Shelter Allocation view. Mirrors OverviewScreen's
// three-column layout/classes so it feels like the same command center rather than a
// separate app, without touching OverviewScreen itself.
import { useEffect, useState } from "react";
import type { ShelterAllocationDetail } from "@/lib/models";
import { getShelterAllocations } from "@/lib/services/dataService";
import BaseMapLoader from "@/components/map/BaseMapLoader";
import ShelterAllocationLayerLoader from "@/components/map/ShelterAllocationLayerLoader";
import ShelterListPanel from "./ShelterListPanel";
import ShelterDetailPanel from "./ShelterDetailPanel";
import RecommendShelterPanel from "./RecommendShelterPanel";

export default function ShelterAllocationScreen() {
  const [shelters, setShelters] = useState<ShelterAllocationDetail[] | null>(null);
  const [selectedShelterId, setSelectedShelterId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getShelterAllocations().then((data) => {
      if (!cancelled) setShelters(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!shelters) {
    return <div className="overview-loading">Loading shelter allocation…</div>;
  }

  const selectedShelter = shelters.find((shelter) => shelter.id === selectedShelterId) ?? null;

  return (
    <div className="overview-screen">
      <div className="overview-main-row">
        <aside className="overview-col overview-col-left">
          <ShelterListPanel shelters={shelters} selectedShelterId={selectedShelterId} onSelectShelter={setSelectedShelterId} />
        </aside>

        <main className="overview-map-area">
          <div className="map-frame">
            <div className="map-frame-canvas">
              <BaseMapLoader>
                <ShelterAllocationLayerLoader selectedShelterId={selectedShelterId} onSelectShelter={setSelectedShelterId} />
              </BaseMapLoader>
            </div>
          </div>
        </main>

        <aside className="overview-col overview-col-right">
          <ShelterDetailPanel shelter={selectedShelter} />
          <RecommendShelterPanel />
        </aside>
      </div>
    </div>
  );
}
