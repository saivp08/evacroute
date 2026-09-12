"use client";

import { useEffect, useState } from "react";
import type { SystemStatus } from "@/lib/models";
import { getSystemStatuses } from "@/lib/services/dataService";

export default function StatusBar() {
  const [now, setNow] = useState<Date | null>(null);
  const [statuses, setStatuses] = useState<SystemStatus[] | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    function poll() {
      getSystemStatuses()
        .then((data) => {
          if (!cancelled) setStatuses(data);
        })
        .catch(() => {
          if (!cancelled) setStatuses([]);
        });
    }
    poll();
    const id = setInterval(poll, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // The backend's own reported health, not a status we infer from incident counts — see
  // getSystemStatuses in lib/services/dataService.ts (backed by GET /health).
  const backendStatus = statuses?.find((s) => s.id === "backend-api");
  const isOperational = backendStatus?.status === "operational";
  const isUnknown = statuses === null;

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
        {isUnknown ? (
          <span className="status-pill">
            <span className="status-dot status-dot-inactive" aria-hidden="true" />
            Connecting…
          </span>
        ) : isOperational ? (
          <span className="status-pill status-pill-ok">
            <span className="status-dot" aria-hidden="true" />
            System Operational
          </span>
        ) : (
          <span className="status-pill status-pill-critical">
            <span className="status-dot status-dot-critical" aria-hidden="true" />
            Backend Connection Unavailable
          </span>
        )}
        <span className="status-bar-time">{now ? now.toLocaleTimeString() : "--:--:--"}</span>
      </div>
    </header>
  );
}
