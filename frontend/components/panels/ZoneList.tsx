import type { Zone } from "@/lib/types";

const STATUS_LABEL: Record<Zone["status"], string> = {
  clear: "Clear",
  "at-risk": "At Risk",
  evacuating: "Evacuating",
  critical: "Critical",
};

export default function ZoneList({ zones, changedZoneIds }: { zones: Zone[]; changedZoneIds?: Set<string> }) {
  return (
    <section className="panel-section">
      <h2>Evacuation Zones ({zones.length} tracts)</h2>
      <ul className="card-list">
        {zones.map((zone) => (
          <li key={zone.id} className={`card zone-status-${zone.status} ${changedZoneIds?.has(zone.id) ? "card-changed" : ""}`}>
            <div className="card-row">
              <strong>{zone.name}</strong>
              <span className="badge">{STATUS_LABEL[zone.status]}</span>
            </div>
            <div className="card-meta">
              {zone.population.toLocaleString()} people &middot; {zone.vulnerablePct.toFixed(0)}% vulnerable
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
