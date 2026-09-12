"use client";

import { useEffect, useState } from "react";
import { useOperations } from "@/lib/services/OperationsProvider";

interface StatusBarProps {
  sectionLabel: string;
  onMenuClick: () => void;
}

export default function StatusBar({ sectionLabel, onMenuClick }: StatusBarProps) {
  const [now, setNow] = useState<Date | null>(null);
  const { data, busy, error } = useOperations();
  const incidents = data?.incidents ?? [];

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const criticalCount = incidents.filter((i) => i.severity === "critical" || i.severity === "high").length;
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
        {error || !data || busy ? (<span className="status-pill">{busy ?? (error ? "Request failed" : "Connecting")}</span>) : isCritical ? (
          <span className="status-pill status-pill-critical">
            <span className="status-dot status-dot-critical" aria-hidden="true" />
            {criticalCount} High-priority Incident{criticalCount > 1 ? "s" : ""}
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
