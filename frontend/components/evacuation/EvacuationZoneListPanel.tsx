import type { EvacuationZoneDetail, ZoneEvacuationStatus } from "@/lib/models";
import OverviewPanel from "@/components/overview/OverviewPanel";

const STATUS_DOT: Record<ZoneEvacuationStatus, string> = {
  evacuate_now: "dot-critical",
  evacuation_in_progress: "dot-warning",
  monitored: "dot-caution",
  clear: "dot-safe",
};

const STATUS_LABEL: Record<ZoneEvacuationStatus, string> = {
  evacuate_now: "Evacuate Now",
  evacuation_in_progress: "Evacuation In Progress",
  monitored: "Monitored",
  clear: "Clear",
};

const STATUS_ORDER: Record<ZoneEvacuationStatus, number> = {
  evacuate_now: 3,
  evacuation_in_progress: 2,
  monitored: 1,
  clear: 0,
};

interface EvacuationZoneListPanelProps {
  zones: EvacuationZoneDetail[];
  selectedZoneId: string | null;
  onSelectZone: (id: string) => void;
}

export default function EvacuationZoneListPanel({ zones, selectedZoneId, onSelectZone }: EvacuationZoneListPanelProps) {
  const sorted = [...zones].sort((a, b) => STATUS_ORDER[b.status] - STATUS_ORDER[a.status]);

  return (
    <OverviewPanel title="Evacuation Zones" count={zones.length}>
      <ul className="ov-list">
        {sorted.map((zone) => {
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
                    <span className="ov-row-tag">{STATUS_LABEL[zone.status]}</span>
                  </div>
                  <div className="ov-row-sub">
                    {zone.population.toLocaleString()} people · {zone.priority} priority
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
