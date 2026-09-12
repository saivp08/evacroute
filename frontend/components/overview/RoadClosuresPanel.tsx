import type { IncidentSeverity, RoadClosure } from "@/lib/models";
import { formatClock } from "@/lib/useRelativeTime";
import OverviewPanel from "./OverviewPanel";

const SEVERITY_DOT: Record<IncidentSeverity, string> = {
  critical: "dot-critical",
  high: "dot-warning",
  medium: "dot-caution",
  low: "dot-inactive",
};

const SEVERITY_ORDER: Record<IncidentSeverity, number> = { critical: 3, high: 2, medium: 1, low: 0 };

interface RoadClosuresPanelProps {
  closures: RoadClosure[];
  selectedClosureId: string | null;
  onSelectClosure: (id: string) => void;
}

export default function RoadClosuresPanel({ closures, selectedClosureId, onSelectClosure }: RoadClosuresPanelProps) {
  if (closures.length === 0) {
    return (
      <OverviewPanel title="Road Closures" count={0}>
        <p className="empty-note">No active closures.</p>
      </OverviewPanel>
    );
  }

  const sorted = [...closures].sort(
    (a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity] || b.reported_at.localeCompare(a.reported_at)
  );

  return (
    <OverviewPanel title="Road Closures" count={closures.length}>
      <ul className="ov-list">
        {sorted.map((closure) => {
          const selected = closure.id === selectedClosureId;
          return (
            <li key={closure.id}>
              <button
                type="button"
                className={`ov-row ov-row-button ${selected ? "ov-row-selected" : ""}`}
                onClick={() => onSelectClosure(closure.id)}
              >
                <span className={`ov-dot ${SEVERITY_DOT[closure.severity]}`} aria-hidden="true" />
                <div className="ov-row-main">
                  <div className="ov-row-title">
                    {closure.road_name}
                    <span className="ov-row-tag">{formatClock(closure.reported_at)}</span>
                  </div>
                  <div className="ov-row-sub">
                    {closure.reason} · {closure.severity}
                  </div>
                  {selected && (
                    <div className="ov-row-detail">
                      <div className="ov-row-detail-line">
                        <span>Status</span>
                        <span>{closure.status}</span>
                      </div>
                      <div className="ov-row-detail-line">
                        <span>Reported</span>
                        <span>{formatClock(closure.reported_at)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </OverviewPanel>
  );
}
