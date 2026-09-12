import type { ShelterAllocationDetail, ShelterAllocationStatus } from "@/lib/models";
import OverviewPanel from "@/components/overview/OverviewPanel";

const STATUS_DOT: Record<ShelterAllocationStatus, string> = {
  available: "dot-safe",
  filling: "dot-caution",
  near_capacity: "dot-warning",
  full: "dot-critical",
};

const STATUS_LABEL: Record<ShelterAllocationStatus, string> = {
  available: "Available",
  filling: "Filling",
  near_capacity: "Near Capacity",
  full: "Full",
};

const STATUS_ORDER: Record<ShelterAllocationStatus, number> = {
  full: 3,
  near_capacity: 2,
  filling: 1,
  available: 0,
};

interface ShelterListPanelProps {
  shelters: ShelterAllocationDetail[];
  selectedShelterId: string | null;
  onSelectShelter: (id: string) => void;
}

export default function ShelterListPanel({ shelters, selectedShelterId, onSelectShelter }: ShelterListPanelProps) {
  const sorted = [...shelters].sort((a, b) => STATUS_ORDER[b.status] - STATUS_ORDER[a.status]);

  return (
    <OverviewPanel title="Shelters" count={shelters.length}>
      <ul className="ov-list">
        {sorted.map((shelter) => {
          const selected = shelter.id === selectedShelterId;
          return (
            <li key={shelter.id}>
              <button
                type="button"
                className={`ov-row ov-row-button ${selected ? "ov-row-selected" : ""}`}
                onClick={() => onSelectShelter(shelter.id)}
              >
                <span className={`ov-dot ${STATUS_DOT[shelter.status]}`} aria-hidden="true" />
                <div className="ov-row-main">
                  <div className="ov-row-title">
                    {shelter.name}
                    <span className="ov-row-tag">{STATUS_LABEL[shelter.status]}</span>
                  </div>
                  <div className="ov-row-sub">
                    {shelter.available_capacity.toLocaleString()} available of {shelter.total_capacity.toLocaleString()}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </OverviewPanel>
  );
}
