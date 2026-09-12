"use client";

import { useEffect, useState } from "react";
import type { Incident } from "@/lib/models";
import { getIncidents } from "@/lib/services/dataService";

interface StatusBarProps {
  sectionLabel: string;
  onMenuClick: () => void;
}

export default function StatusBar({ sectionLabel, onMenuClick }: StatusBarProps) {
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
        <button type="button" className="sidebar-toggle" onClick={onMenuClick} aria-label="Toggle navigation">
          ☰
        </button>
        <span className="status-bar-section">{sectionLabel}</span>
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
