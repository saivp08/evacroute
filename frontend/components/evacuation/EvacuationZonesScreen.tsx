"use client";

// Phase 8 — dedicated, map-first Evacuation Zones view. Mirrors OverviewScreen's
// three-column layout/classes so it feels like the same command center rather than a
// separate app, without touching OverviewScreen itself.
import { useEffect, useState } from "react";
import type { EvacuationZoneDetail } from "@/lib/models";
import { getEvacuationZoneDetails } from "@/lib/services/dataService";
import BaseMapLoader from "@/components/map/BaseMapLoader";
import EvacuationZoneLayerLoader from "@/components/map/EvacuationZoneLayerLoader";
import EvacuationZoneListPanel from "./EvacuationZoneListPanel";
import EvacuationZoneDetailPanel from "./EvacuationZoneDetailPanel";

export default function EvacuationZonesScreen() {
  const [zones, setZones] = useState<EvacuationZoneDetail[] | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [planVisible, setPlanVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getEvacuationZoneDetails().then((data) => {
      if (!cancelled) setZones(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A plan shown for one zone shouldn't silently carry over onto the next selection.
  useEffect(() => {
    setPlanVisible(false);
  }, [selectedZoneId]);

  if (!zones) {
    return <div className="overview-loading">Loading evacuation zones…</div>;
  }

  const selectedZone = zones.find((zone) => zone.id === selectedZoneId) ?? null;

  return (
    <div className="overview-screen">
      <div className="overview-main-row">
        <aside className="overview-col overview-col-left">
          <EvacuationZoneListPanel zones={zones} selectedZoneId={selectedZoneId} onSelectZone={setSelectedZoneId} />
        </aside>

        <main className="overview-map-area">
          <div className="map-frame">
            <div className="map-frame-canvas">
              <BaseMapLoader>
                <EvacuationZoneLayerLoader
                  selectedZoneId={selectedZoneId}
                  onSelectZone={setSelectedZoneId}
                  planVisible={planVisible}
                />
              </BaseMapLoader>
            </div>
          </div>
        </main>

        <aside className="overview-col overview-col-right">
          <EvacuationZoneDetailPanel
            zone={selectedZone}
            planVisible={planVisible}
            onTogglePlan={() => setPlanVisible((visible) => !visible)}
          />
        </aside>
      </div>
    </div>
  );
}
