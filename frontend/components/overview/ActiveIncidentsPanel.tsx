import type { Incident, IncidentSeverity } from "@/lib/models";
import { INCIDENT_SHAPE, shapeClassName } from "@/lib/entitySymbols";
import OverviewPanel from "./OverviewPanel";

const SEVERITY_DOT: Record<IncidentSeverity, string> = {
  critical: "dot-critical",
  high: "dot-warning",
  medium: "dot-caution",
  low: "dot-inactive",
};

const SEVERITY_ORDER: Record<IncidentSeverity, number> = { critical: 3, high: 2, medium: 1, low: 0 };

interface ActiveIncidentsPanelProps {
  incidents: Incident[];
  selectedIncidentId: string | null;
  onSelectIncident: (id: string) => void;
}

// A quick-glance list only — one line per incident, real severity color, no buried detail.
// Click opens the full InspectorPanel instead of expanding inline.
export default function ActiveIncidentsPanel({ incidents, selectedIncidentId, onSelectIncident }: ActiveIncidentsPanelProps) {
  if (incidents.length === 0) {
    return (
      <OverviewPanel title="Active Incidents" count={0}>
        <p className="rail-empty">No active incidents.</p>
      </OverviewPanel>
    );
  }

  const sorted = [...incidents].sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);

  return (
    <OverviewPanel title="Active Incidents" count={incidents.length}>
      <ul className="rail-list">
        {sorted.map((incident) => (
          <li key={incident.id}>
            <button
              type="button"
              className={`rail-row ${incident.id === selectedIncidentId ? "rail-row-selected" : ""}`}
              onClick={() => onSelectIncident(incident.id)}
            >
              <span className={`rail-row-glyph ${shapeClassName(INCIDENT_SHAPE)}`} aria-hidden="true" />
              <span className="rail-row-text">
                {incident.reportedTypeLabel ?? incident.type.replace(/_/g, " ")}
                {incident.zone_id ? ` · Zone ${incident.zone_id.split("-").pop()?.toUpperCase()}` : ""}
              </span>
              <span className={`ov-dot ${SEVERITY_DOT[incident.severity]}`} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </OverviewPanel>
  );
}
