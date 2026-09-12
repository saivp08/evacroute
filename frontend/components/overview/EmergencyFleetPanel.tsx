import type { Vehicle, VehicleStatus } from "@/lib/models";
import { useTickingEta } from "@/lib/useTickingEta";
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

export default function EmergencyFleetPanel({ vehicles, selectedVehicleId, onSelectVehicle }: EmergencyFleetPanelProps) {
  const ticked = useTickingEta(vehicles);
  return (
    <OverviewPanel title="Emergency Fleet" count={ticked.length}>
      <ul className="ov-list">
        {ticked.map((vehicle) => {
          const selected = vehicle.id === selectedVehicleId;
          return (
            <li key={vehicle.id}>
              <button
                type="button"
                className={`ov-row ov-row-button ${selected ? "ov-row-selected" : ""}`}
                onClick={() => onSelectVehicle(vehicle.id)}
              >
                <span
                  className={`ov-dot ${STATUS_DOT[vehicle.status]} ${
                    vehicle.status === "en_route" || vehicle.status === "on_scene" ? "ov-dot-pulse" : ""
                  }`}
                  aria-hidden="true"
                />
                <div className="ov-row-main">
                  <div className="ov-row-title">
                    {vehicle.callsign}
                    <span className="ov-row-tag">{vehicle.status.replace(/_/g, " ")}</span>
                  </div>
                  <div className="ov-row-sub">{vehicle.type.replace(/_/g, " ")}</div>
                  {selected && (
                    <div className="ov-row-detail">
                      <div className="ov-row-detail-line">
                        <span>Destination</span>
                        <span>{vehicle.destination ?? "—"}</span>
                      </div>
                      <div className="ov-row-detail-line">
                        <span>ETA</span>
                        <span>{vehicle.eta_minutes !== null ? `${vehicle.eta_minutes} min` : "—"}</span>
                      </div>
                      <div className="ov-row-detail-line">
                        <span>Priority</span>
                        <span>{vehicle.priority}</span>
                      </div>
                    </div>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </OverviewPanel>
  );
}
