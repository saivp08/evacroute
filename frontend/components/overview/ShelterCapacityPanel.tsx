import type { Shelter } from "@/lib/models";
import OverviewPanel from "./OverviewPanel";

function fillClass(pct: number) {
  if (pct >= 95) return "ov-fill-critical";
  if (pct >= 70) return "ov-fill-caution";
  return "ov-fill-safe";
}

export default function ShelterCapacityPanel({ shelters }: { shelters: Shelter[] }) {
  return (
    <OverviewPanel title="Shelter Capacity" count={shelters.length}>
      <ul className="ov-list">
        {shelters.map((shelter) => {
          const pct = shelter.capacity > 0 ? Math.round((shelter.occupancy / shelter.capacity) * 100) : 0;
          return (
            <li key={shelter.id} className="ov-row ov-row-stacked">
              <div className="ov-row-title">
                {shelter.name}
                <span className="ov-row-tag">{shelter.status}</span>
              </div>
              <div className="ov-row-sub">
                {shelter.occupancy.toLocaleString()} / {shelter.capacity.toLocaleString()} ({pct}%)
              </div>
              <div className="ov-progress">
                <div className={`ov-progress-fill ${fillClass(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </OverviewPanel>
  );
}
