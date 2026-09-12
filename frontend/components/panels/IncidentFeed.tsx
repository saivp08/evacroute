import type { Incident } from "@/lib/types";

const SEVERITY_COLOR: Record<Incident["severity"], string> = {
  low: "#38bdf8",
  medium: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};

export default function IncidentFeed({ incidents }: { incidents: Incident[] }) {
  return (
    <section className="panel-section">
      <h2>Incident Feed</h2>
      {incidents.length === 0 ? (
        <p className="empty-note">No incidents reported yet.</p>
      ) : (
        <ul className="card-list">
          {incidents.map((incident) => (
            <li key={incident.id} className="card" style={{ borderLeftColor: SEVERITY_COLOR[incident.severity] }}>
              <div className="card-row">
                <strong>{incident.type.replace("-", " ")}</strong>
                <span className="card-time">{new Date(incident.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="card-meta">{incident.description}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
