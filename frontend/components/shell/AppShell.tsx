"use client";

import { OperationsProvider } from "@/lib/services/OperationsProvider";
import { useState } from "react";
import Sidebar, { type NavKey } from "./Sidebar";
import StatusBar from "./StatusBar";
import PlaceholderSection from "./PlaceholderSection";
import OverviewScreen from "@/components/overview/OverviewScreen";

const SECTION_LABEL: Record<NavKey, string> = {
  overview: "Overview",
  incidents: "Incidents",
  fleet: "Fleet",
  evacuation: "Evacuation",
  shelters: "Shelters",
  hazards: "Hazards",
  intelligence: "Intelligence",
};

const PLACEHOLDER_COPY: Partial<Record<NavKey, string>> = {
  incidents: "A dedicated incident log and triage view will live here.",
  fleet: "Ambulance and rescue-team fleet status will live here.",
  evacuation: "Zone-by-zone evacuation progress will live here.",
  shelters: "Shelter capacity and intake management will live here.",
  hazards: "Active hazard and closure tracking will live here.",
  intelligence: "Situational reports and analysis will live here.",
};

export default function AppShell() {
  const [active, setActive] = useState<NavKey>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <OperationsProvider><div className="app-shell">
      <Sidebar active={active} onSelect={setActive} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <StatusBar sectionLabel={SECTION_LABEL[active]} onMenuClick={() => setSidebarOpen((v) => !v)} />
        <div className="app-content">
          {active === "overview" ? (
            <OverviewScreen />
          ) : (
            <PlaceholderSection title={SECTION_LABEL[active]} description={PLACEHOLDER_COPY[active] ?? ""} />
          )}
        </div>
      </div>
    </div></OperationsProvider>
  );
}
