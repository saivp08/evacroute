import type { EvacuationZone, EvacuationZoneStatus } from "@/lib/models";
import OverviewPanel from "./OverviewPanel";

const STATUS_DOT: Record<EvacuationZoneStatus, string> = {
  clear: "dot-safe",
  advisory: "dot-caution",
  warning: "dot-warning",
  mandatory: "dot-critical",
};

interface EvacuationStatusPanelProps {
  zones: EvacuationZone[];
  selectedZoneId: string | null;
  onSelectZone: (id: string) => void;
}

export default function EvacuationStatusPanel({ zones, selectedZoneId, onSelectZone }: EvacuationStatusPanelProps) {
  if (zones.length === 0) {
    return (
      <OverviewPanel title="Evacuation Zones" count={0}>
        <p className="empty-note">No evacuation zone data available.</p>
      </OverviewPanel>
    );
  }

  return (
    <OverviewPanel title="Evacuation Zones" count={zones.length}>
      <ul className="ov-list">
        {zones.map((zone) => {
          const selected = zone.id === selectedZoneId;
          return (
            <li key={zone.id}>
              <button
                type="button"
                className={`ov-row ov-row-button ${selected ? "ov-row-selected" : ""}`}
                onClick={() => onSelectZone(zone.id)}
              >
                <span className={`ov-dot ${STATUS_DOT[zone.status]}`} aria-hidden="true" />
                <div className="ov-row-main">
                  <div className="ov-row-title">
                    {zone.name}
                    <span className="ov-row-tag">{zone.status}</span>
                  </div>
                  <div className="ov-row-sub">{zone.population.toLocaleString()} people</div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </OverviewPanel>
  );
}
