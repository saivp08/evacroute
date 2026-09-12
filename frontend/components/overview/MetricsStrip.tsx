import type { PlanResponse } from "@/lib/services/apiTypes";

export default function MetricsStrip({ metrics }: { metrics: PlanResponse["metrics"] | null }) {
  const minutes = (seconds: number) => `${(seconds / 60).toFixed(1)} min`;
  return <div className="metrics-strip">
    <div className="metrics-strip-tile"><div className="metrics-strip-value">{metrics?.assigned_evacuees.toLocaleString() ?? "-"}</div><div className="metrics-strip-label">Assigned Evacuees</div></div>
    <div className="metrics-strip-tile"><div className="metrics-strip-value">{metrics ? minutes(metrics.average_effective_travel_time_s) : "-"}</div><div className="metrics-strip-label">Average Evacuation ETA</div></div>
    <div className="metrics-strip-tile"><div className="metrics-strip-value">{metrics && metrics.ambulances_dispatched + metrics.rescue_teams_dispatched > 0 ? minutes(metrics.average_effective_emergency_response_time_s) : "-"}</div><div className="metrics-strip-label">Planned Response ETA</div></div>
  </div>;
}
