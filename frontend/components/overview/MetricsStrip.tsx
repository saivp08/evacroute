import type { OperationsMetrics } from "@/lib/models";

export default function MetricsStrip({ metrics }: { metrics: OperationsMetrics }) {
  return (
    <div className="metrics-strip">
      <div className="metrics-strip-tile">
        <div className="metrics-strip-value">{metrics.evacuation_flow_per_hour.toLocaleString()}</div>
        <div className="metrics-strip-label">Evacuation Flow (people/hr)</div>
      </div>
      <div className="metrics-strip-tile">
        <div className="metrics-strip-value">{metrics.avg_response_eta_minutes} min</div>
        <div className="metrics-strip-label">Emergency Response ETA</div>
      </div>
      <div className={`metrics-strip-tile ${metrics.transportation_bottlenecks > 0 ? "metrics-strip-tile-warning" : ""}`}>
        <div className={`metrics-strip-value ${metrics.transportation_bottlenecks > 0 ? "metrics-strip-value-warning" : ""}`}>
          {metrics.transportation_bottlenecks}
        </div>
        <div className="metrics-strip-label">Transportation Bottlenecks</div>
      </div>
    </div>
  );
}
