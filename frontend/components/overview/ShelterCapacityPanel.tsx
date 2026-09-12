import type { Shelter } from "@/lib/models";
import OverviewPanel from "./OverviewPanel";

function fillClass(pct: number) {
  if (pct >= 95) return "ov-fill-critical";
  if (pct >= 70) return "ov-fill-caution";
  return "ov-fill-safe";
}

interface ShelterCapacityPanelProps {
  shelters: Shelter[];
  selectedShelterId: string | null;
  onSelectShelter: (id: string) => void;
}

export default function ShelterCapacityPanel({ shelters, selectedShelterId, onSelectShelter }: ShelterCapacityPanelProps) {
  if (shelters.length === 0) {
    return (
      <OverviewPanel title="Shelters" count={0}>
        <p className="empty-note">No shelter data available.</p>
      </OverviewPanel>
    );
  }

  return (
    <OverviewPanel title="Shelters" count={shelters.length}>
      <ul className="ov-list">
        {shelters.map((shelter) => {
          const pct = shelter.capacity > 0 ? Math.round((shelter.occupancy / shelter.capacity) * 100) : 0;
          const selected = shelter.id === selectedShelterId;
          return (
            <li key={shelter.id}>
              <button
                type="button"
                className={`ov-row ov-row-button ov-row-stacked ${selected ? "ov-row-selected" : ""}`}
                onClick={() => onSelectShelter(shelter.id)}
              >
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
              </button>
            </li>
          );
        })}
      </ul>
    </OverviewPanel>
  );
}
