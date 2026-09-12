"use client";

// Real road-network health, computed in the frontend from the backend's actual per-road
// status (see getNetworkStatus in lib/services/dataService.ts) — no invented congestion
// tiers or fixed percentages. The backend only distinguishes open vs. closed at the road
// level today; if/when it reports finer-grained congestion, extend the bars then.
import { useEffect, useState } from "react";
import type { NetworkStatus } from "@/lib/models";
import { getNetworkStatus } from "@/lib/services/dataService";
import OverviewPanel from "./OverviewPanel";

export default function NetworkStatusPanel() {
  const [status, setStatus] = useState<NetworkStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    getNetworkStatus().then((data) => {
      if (!cancelled) setStatus(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) {
    return (
      <OverviewPanel title="Network Status">
        <p className="empty-note">Loading road network…</p>
      </OverviewPanel>
    );
  }

  if (status.total_roads === 0) {
    return (
      <OverviewPanel title="Network Status">
        <p className="empty-note">Road network data unavailable.</p>
      </OverviewPanel>
    );
  }

  return (
    <OverviewPanel title="Network Status">
      <div className="traffic-summary-bars">
        <div className="traffic-summary-row">
          <div className="traffic-summary-row-header">
            <span>Open</span>
            <span>{status.open_percent}%</span>
          </div>
          <div className="traffic-summary-track">
            <div className="traffic-summary-fill" style={{ width: `${status.open_percent}%`, background: "var(--success)" }} />
          </div>
        </div>
        <div className="traffic-summary-row">
          <div className="traffic-summary-row-header">
            <span>Closed</span>
            <span>{status.closed_percent}%</span>
          </div>
          <div className="traffic-summary-track">
            <div className="traffic-summary-fill" style={{ width: `${status.closed_percent}%`, background: "var(--danger)" }} />
          </div>
        </div>
      </div>

      <div className="incident-hero-grid traffic-summary-stats">
        <div>
          <div className="incident-hero-stat-label">Total Roads</div>
          <div className="incident-hero-stat-value">{status.total_roads.toLocaleString()}</div>
        </div>
        <div>
          <div className="incident-hero-stat-label">Closed Segments</div>
          <div className="incident-hero-stat-value">{status.closed_count.toLocaleString()}</div>
        </div>
      </div>
    </OverviewPanel>
  );
}
