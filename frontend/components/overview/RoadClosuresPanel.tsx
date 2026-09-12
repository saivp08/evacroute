import type { RoadClosure } from "@/lib/models";
import { CLOSURE_SHAPE, shapeClassName } from "@/lib/entitySymbols";
import OverviewPanel from "./OverviewPanel";

interface RoadClosuresPanelProps {
  closures: RoadClosure[];
  selectedClosureId: string | null;
  onSelectClosure: (id: string) => void;
}

export default function RoadClosuresPanel({ closures, selectedClosureId, onSelectClosure }: RoadClosuresPanelProps) {
  if (closures.length === 0) {
    return (
      <OverviewPanel title="Road Closures" count={0}>
        <p className="rail-empty">No active closures.</p>
      </OverviewPanel>
    );
  }

  return (
    <OverviewPanel title="Road Closures" count={closures.length}>
      <ul className="rail-list">
        {closures.map((closure) => (
          <li key={closure.id}>
            <button
              type="button"
              className={`rail-row ${closure.id === selectedClosureId ? "rail-row-selected" : ""}`}
              onClick={() => onSelectClosure(closure.id)}
            >
              <span className={`rail-row-glyph ${shapeClassName(CLOSURE_SHAPE)}`} aria-hidden="true" />
              <span className="rail-row-text">{closure.road_name}</span>
              <span className="ov-dot dot-critical" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </OverviewPanel>
  );
}
