"use client";

import { useEffect, useState } from "react";
import type { TrafficSummary } from "@/lib/models";
import { getTrafficSummary } from "@/lib/services/dataService";
import OverviewPanel from "./OverviewPanel";

const BARS: { key: keyof TrafficSummary; label: string; colorVar: string }[] = [
  { key: "free_percent", label: "Normal", colorVar: "--success" },
  { key: "moderate_percent", label: "Moderate", colorVar: "--caution" },
  { key: "heavy_percent", label: "Heavy", colorVar: "--warning" },
  { key: "severe_percent", label: "Severe", colorVar: "--danger" },
];

export default function TrafficSummaryPanel() {
  const [summary, setSummary] = useState<TrafficSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTrafficSummary().then((data) => {
      if (!cancelled) setSummary(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!summary) {
    return (
      <OverviewPanel title="Network Status">
        <p className="empty-note">Loading traffic data…</p>
      </OverviewPanel>
    );
  }

  return (
    <OverviewPanel title="Network Status">
      <div className="traffic-summary-bars">
        {BARS.map((bar) => {
          const percent = summary[bar.key] as number;
          return (
            <div key={bar.key} className="traffic-summary-row">
              <div className="traffic-summary-row-header">
                <span>{bar.label}</span>
                <span>{percent}%</span>
              </div>
              <div className="traffic-summary-track">
                <div
                  className="traffic-summary-fill"
                  style={{ width: `${percent}%`, background: `var(${bar.colorVar})` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="incident-hero-grid traffic-summary-stats">
        <div>
          <div className="incident-hero-stat-label">Vehicles</div>
          <div className="incident-hero-stat-value">{summary.vehicle_count.toLocaleString()}</div>
        </div>
        <div>
          <div className="incident-hero-stat-label">Average Speed</div>
          <div className="incident-hero-stat-value">{summary.average_speed_mph} mph</div>
        </div>
      </div>
    </OverviewPanel>
  );
}
