import type { Incident, IncidentSeverity } from "@/lib/models";
import { useNow, formatRelativeTime, formatClock } from "@/lib/useRelativeTime";
import OverviewPanel from "./OverviewPanel";

const SEVERITY_DOT: Record<IncidentSeverity, string> = {
  critical: "dot-critical",
  high: "dot-warning",
  medium: "dot-caution",
  low: "dot-inactive",
};

const SEVERITY_HERO_CLASS: Record<IncidentSeverity, string> = {
  critical: "incident-hero",
  high: "incident-hero incident-hero-warning",
  medium: "incident-hero incident-hero-caution",
  low: "incident-hero incident-hero-inactive",
};

const SEVERITY_ORDER: Record<IncidentSeverity, number> = { critical: 3, high: 2, medium: 1, low: 0 };

interface ActiveIncidentsPanelProps {
  incidents: Incident[];
  selectedIncidentId: string | null;
  onSelectIncident: (id: string) => void;
}

export default function ActiveIncidentsPanel({ incidents, selectedIncidentId, onSelectIncident }: ActiveIncidentsPanelProps) {
  const now = useNow();
  if (incidents.length === 0) {
    return (
      <OverviewPanel title="Active Incidents" count={0}>
        <p className="empty-note">No incidents reported.</p>
      </OverviewPanel>
    );
  }

  const sorted = [...incidents].sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);
  const [top, ...rest] = sorted;

  return (
    <OverviewPanel title="Active Incidents" count={incidents.length}>
      <button
        type="button"
        className={`incident-hero-button ${SEVERITY_HERO_CLASS[top.severity]} ${
          top.id === selectedIncidentId ? "incident-hero-selected" : ""
        }`}
        onClick={() => onSelectIncident(top.id)}
      >
        <span className="incident-hero-severity">
          <span className={`ov-dot ${SEVERITY_DOT[top.severity]} ${top.severity === "critical" ? "ov-dot-pulse" : ""}`} aria-hidden="true" />
          {top.severity}
        </span>
        <div className="incident-hero-title">{top.type.replace(/_/g, " ")}</div>
        <div className="incident-hero-grid">
          <div>
            <div className="incident-hero-stat-label">Status</div>
            <div className="incident-hero-stat-value" style={{ textTransform: "capitalize" }}>
              {top.status.replace(/_/g, " ")}
            </div>
          </div>
          <div>
            <div className="incident-hero-stat-label">Zone</div>
            <div className="incident-hero-stat-value">{top.zone_id ?? "Unavailable"}</div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div className="incident-hero-stat-label">Last Updated</div>
            <div className="incident-hero-stat-value" title={formatClock(top.reported_at)}>
              {formatRelativeTime(top.reported_at, now)}
            </div>
          </div>
        </div>
      </button>

      {rest.length > 0 && (
        <ul className="ov-list">
          {rest.map((incident) => {
            const selected = incident.id === selectedIncidentId;
            return (
              <li key={incident.id}>
                <button
                  type="button"
                  className={`ov-row ov-row-button ${selected ? "ov-row-selected" : ""}`}
                  onClick={() => onSelectIncident(incident.id)}
                >
                  <span className={`ov-dot ${SEVERITY_DOT[incident.severity]}`} aria-hidden="true" />
                  <div className="ov-row-main">
                    <div className="ov-row-title">
                      {incident.type.replace(/_/g, " ")}
                      <span className="ov-row-tag">{incident.status.replace(/_/g, " ")}</span>
                    </div>
                    <div className="ov-row-sub">{incident.description}</div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </OverviewPanel>
  );
}
