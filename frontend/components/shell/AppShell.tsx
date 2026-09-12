"use client";

import StatusBar from "./StatusBar";
import OverviewScreen from "@/components/overview/OverviewScreen";

export default function AppShell() {
  return (
    <div className="app-shell">
      <div className="app-main">
        <StatusBar />
        <div className="app-content">
          <OverviewScreen />
        </div>
      </div>
    </div>
  );
}
