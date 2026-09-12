"use client";

// Archived, unrouted snapshot demo. app/page.tsx uses the API-backed AppShell.

import { useState } from "react";
import MapPanel from "@/components/map/MapPanel";
import ZoneList from "@/components/panels/ZoneList";
import ShelterList from "@/components/panels/ShelterList";
import IncidentFeed from "@/components/panels/IncidentFeed";
import IncidentInput from "@/components/panels/IncidentInput";
import AmbulanceList from "@/components/panels/AmbulanceList";
import TrafficChart from "@/components/panels/TrafficChart";
import TopBar from "@/components/dashboard/TopBar";
import { getInitialScenario, applyIncidentText } from "@/lib/scenario";
import { diffScenarios } from "@/lib/diff";
import type { ScenarioState } from "@/lib/types";

const MAP_CENTER: [number, number] = [38.4404, -122.7141];

export default function Dashboard() {
  const [scenario, setScenario] = useState<ScenarioState>(() => getInitialScenario());
  const [changes, setChanges] = useState<string[]>([]);
  const [changedZoneIds, setChangedZoneIds] = useState<Set<string>>(new Set());

  function handleIncident(text: string) {
    setScenario((prev) => {
      const next = applyIncidentText(prev, text);
      const diffs = diffScenarios(prev, next);
      setChanges(diffs);
      const changedIds = new Set(
        next.zones.filter((z, i) => z.status !== prev.zones[i]?.status).map((z) => z.id)
      );
      setChangedZoneIds(changedIds);
      return next;
    });
  }

  return (
    <div className="dashboard">
      <TopBar metrics={scenario.metrics} />
      {changes.length > 0 && (
        <div className="change-banner">
          <strong>Plan updated:</strong>
          <ul>
            {changes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="dashboard-body">
        <aside className="panel panel-left">
          <ZoneList zones={scenario.zones} changedZoneIds={changedZoneIds} />
          <ShelterList shelters={scenario.shelters} assignments={scenario.assignments} />
        </aside>
        <main className="panel panel-center">
          <MapPanel scenario={scenario} center={MAP_CENTER} changedZoneIds={changedZoneIds} />
        </main>
        <aside className="panel panel-right">
          <IncidentInput onSubmit={handleIncident} />
          <IncidentFeed incidents={scenario.incidents} />
          <AmbulanceList ambulances={scenario.ambulances} />
          <TrafficChart traffic={scenario.traffic} />
        </aside>
      </div>
    </div>
  );
}
