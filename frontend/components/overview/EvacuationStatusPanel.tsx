import type { EvacuationZone, EvacuationZoneStatus } from "@/lib/models";
import OverviewPanel from "./OverviewPanel";

const STATUS_DOT: Record<EvacuationZoneStatus, string> = {
  clear: "dot-safe",
  advisory: "dot-caution",
  warning: "dot-warning",
  mandatory: "dot-critical",
};

export default function EvacuationStatusPanel({ zones }: { zones: EvacuationZone[] }) {
  return (
    <OverviewPanel title="Evacuation Status" count={zones.length}>
      <ul className="ov-list">
        {zones.map((zone) => (
          <li key={zone.id} className="ov-row">
            <span className={`ov-dot ${STATUS_DOT[zone.status]}`} aria-hidden="true" />
            <div className="ov-row-main">
              <div className="ov-row-title">
                {zone.name}
                <span className="ov-row-tag">{zone.status}</span>
              </div>
              <div className="ov-row-sub">{zone.population.toLocaleString()} people</div>
            </div>
          </li>
        ))}
      </ul>
    </OverviewPanel>
  );
}
