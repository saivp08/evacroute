import type { Vehicle, VehicleStatus } from "@/lib/models";
import { useTickingEta } from "@/lib/useTickingEta";
import { VEHICLE_SHAPE, shapeClassName } from "@/lib/entitySymbols";
import OverviewPanel from "./OverviewPanel";

const STATUS_DOT: Record<VehicleStatus, string> = {
  available: "dot-safe",
  en_route: "dot-response",
  on_scene: "dot-response",
  returning: "dot-caution",
  out_of_service: "dot-inactive",
};

interface EmergencyFleetPanelProps {
  vehicles: Vehicle[];
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
}

// One line per vehicle — callsign, status color, nothing else. Click opens the full
// InspectorPanel (ETA/destination/route/priority) instead of expanding this row.
export default function EmergencyFleetPanel({ vehicles, selectedVehicleId, onSelectVehicle }: EmergencyFleetPanelProps) {
  const ticked = useTickingEta(vehicles);
  const responding = ticked.filter((v) => v.status === "en_route" || v.status === "on_scene").length;

  return (
    <OverviewPanel title="Emergency Fleet" count={ticked.length} subtitle={responding > 0 ? `${responding} responding` : undefined}>
      <ul className="rail-list">
        {ticked.map((vehicle) => (
          <li key={vehicle.id}>
            <button
              type="button"
              className={`rail-row ${vehicle.id === selectedVehicleId ? "rail-row-selected" : ""}`}
              onClick={() => onSelectVehicle(vehicle.id)}
            >
              <span className={`rail-row-glyph ${shapeClassName(VEHICLE_SHAPE)}`} aria-hidden="true" />
              <span className="rail-row-text">{vehicle.callsign}</span>
              <span className={`ov-dot ${STATUS_DOT[vehicle.status]} ${vehicle.status === "en_route" || vehicle.status === "on_scene" ? "ov-dot-pulse" : ""}`} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </OverviewPanel>
  );
}
