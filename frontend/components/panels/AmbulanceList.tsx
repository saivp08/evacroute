import type { Ambulance } from "@/lib/types";

export default function AmbulanceList({ ambulances }: { ambulances: Ambulance[] }) {
  return (
    <section className="panel-section">
      <h2>Response Units (simulated)</h2>
      {ambulances.length === 0 ? (
        <p className="empty-note">No units dispatched.</p>
      ) : (
        <ul className="card-list">
          {ambulances.map((a) => (
            <li key={a.id} className="card">
              <div className="card-row">
                <strong>{a.id}</strong>
              </div>
              <div className="card-meta">
                {a.stationName} &rarr; {a.destinationZoneName}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
