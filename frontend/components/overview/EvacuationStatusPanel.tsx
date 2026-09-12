import type { EvacuationZone, EvacuationZoneStatus } from "@/lib/models";
import { ZONE_SHAPE, shapeClassName } from "@/lib/entitySymbols";
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
      <OverviewPanel title="Evacuation" count={0}>
        <p className="rail-empty">No evacuation zone data available.</p>
      </OverviewPanel>
    );
  }

  return (
    <OverviewPanel title="Evacuation" count={zones.length}>
      <ul className="rail-list">
        {zones.map((zone) => (
          <li key={zone.id}>
            <button
              type="button"
              className={`rail-row ${zone.id === selectedZoneId ? "rail-row-selected" : ""}`}
              onClick={() => onSelectZone(zone.id)}
            >
              <span className={`rail-row-glyph ${shapeClassName(ZONE_SHAPE)}`} aria-hidden="true" />
              <span className="rail-row-text">{zone.name}</span>
              <span className="rail-row-meta">{zone.status}</span>
              <span className={`ov-dot ${STATUS_DOT[zone.status]}`} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </OverviewPanel>
  );
}
