import type { Assignment, Shelter } from "@/lib/types";

export default function ShelterList({ shelters, assignments }: { shelters: Shelter[]; assignments: Assignment[] }) {
  const assignedByShelter = new Map<string, number>();
  for (const a of assignments) {
    assignedByShelter.set(a.shelterId, (assignedByShelter.get(a.shelterId) ?? 0) + a.people);
  }
  const used = shelters.filter((s) => (assignedByShelter.get(s.id) ?? 0) > 0);

  return (
    <section className="panel-section">
      <h2>Shelters ({used.length}/{shelters.length} in use)</h2>
      <ul className="card-list">
        {used.map((shelter) => {
          const occupancy = assignedByShelter.get(shelter.id) ?? 0;
          const pct = shelter.capacity > 0 ? Math.round((occupancy / shelter.capacity) * 100) : 0;
          const full = pct >= 90;
          return (
            <li key={shelter.id} className="card">
              <div className="card-row">
                <strong>{shelter.name}</strong>
                <span className={`badge ${full ? "badge-critical" : ""}`}>{pct}%</span>
              </div>
              <div className="card-meta">
                {occupancy.toLocaleString()} / {shelter.capacity.toLocaleString()} capacity
              </div>
              <div className="progress-bar">
                <div className={`progress-fill ${full ? "progress-fill-critical" : ""}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
