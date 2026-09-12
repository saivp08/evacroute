"use client";

import { useEffect, useState } from "react";
import type { Incident } from "@/lib/models";
import { getIncidents } from "@/lib/services/dataService";

export default function StatusBar() {
  const [now, setNow] = useState<Date | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getIncidents().then((data) => {
      if (!cancelled) setIncidents(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const criticalCount = incidents.filter((i) => i.severity === "critical").length;
  const isCritical = criticalCount > 0;

  return (
    <header className="app-status-bar">
      <div className="status-bar-left">
        <div className="status-bar-brand">
          <span className="status-bar-brand-mark">EV</span>
          <div>
            <div className="status-bar-brand-name">EvacRoute</div>
            <div className="status-bar-brand-tag">Operations Center</div>
          </div>
        </div>
      </div>
      <div className="status-bar-right">
        {isCritical ? (
          <span className="status-pill status-pill-critical">
            <span className="status-dot status-dot-critical" aria-hidden="true" />
            {criticalCount} Critical Incident{criticalCount > 1 ? "s" : ""}
          </span>
        ) : (
          <span className="status-pill status-pill-ok">
            <span className="status-dot" aria-hidden="true" />
            System Operational
          </span>
        )}
        <span className="status-bar-time">{now ? now.toLocaleTimeString() : "--:--:--"}</span>
      </div>
    </header>
  );
}
