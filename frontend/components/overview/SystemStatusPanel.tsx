import type { SystemStatus, SystemStatusLevel } from "@/lib/models";
import OverviewPanel from "./OverviewPanel";

const STATUS_DOT: Record<SystemStatusLevel, string> = {
  operational: "dot-safe",
  degraded: "dot-caution",
  offline: "dot-critical",
};

export default function SystemStatusPanel({ statuses }: { statuses: SystemStatus[] }) {
  return (
    <OverviewPanel title="System Status">
      <ul className="ov-list">
        {statuses.map((system) => (
          <li key={system.id} className="ov-row">
            <span
              className={`ov-dot ${STATUS_DOT[system.status]} ${system.status === "operational" ? "ov-dot-pulse" : ""}`}
              aria-hidden="true"
            />
            <div className="ov-row-main">
              <div className="ov-row-title">
                {system.label}
                <span className="ov-row-tag">{system.status}</span>
              </div>
              <div className="ov-row-sub">{system.detail}</div>
            </div>
          </li>
        ))}
      </ul>
    </OverviewPanel>
  );
}
