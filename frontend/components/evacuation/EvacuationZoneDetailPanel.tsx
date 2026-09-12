import type { EvacuationZoneDetail, ZoneEvacuationStatus } from "@/lib/models";
import OverviewPanel from "@/components/overview/OverviewPanel";

// Reuses the existing "incident hero" treatment (see ActiveIncidentsPanel) so a featured
// zone reads the same way a featured incident does — same severity tiers, same colors.
const STATUS_HERO_CLASS: Record<ZoneEvacuationStatus, string> = {
  evacuate_now: "incident-hero",
  evacuation_in_progress: "incident-hero incident-hero-warning",
  monitored: "incident-hero incident-hero-caution",
  clear: "incident-hero incident-hero-inactive",
};

const STATUS_LABEL: Record<ZoneEvacuationStatus, string> = {
  evacuate_now: "Evacuate Now",
  evacuation_in_progress: "Evacuation In Progress",
  monitored: "Monitored",
  clear: "Clear",
};

interface EvacuationZoneDetailPanelProps {
  zone: EvacuationZoneDetail | null;
  planVisible: boolean;
  onTogglePlan: () => void;
}

export default function EvacuationZoneDetailPanel({ zone, planVisible, onTogglePlan }: EvacuationZoneDetailPanelProps) {
  if (!zone) {
    return (
      <OverviewPanel title="Zone Detail">
        <p className="empty-note">Select a zone to view evacuation details.</p>
      </OverviewPanel>
    );
  }

  return (
    <OverviewPanel title="Zone Detail">
      <div className={STATUS_HERO_CLASS[zone.status]}>
        <span className="incident-hero-severity">{zone.id.toUpperCase()}</span>
        <div className="incident-hero-title">{STATUS_LABEL[zone.status]}</div>
        <div className="incident-hero-grid">
          <div>
            <div className="incident-hero-stat-label">Population</div>
            <div className="incident-hero-stat-value">{zone.population.toLocaleString()}</div>
          </div>
          <div>
            <div className="incident-hero-stat-label">Evacuated</div>
            <div className="incident-hero-stat-value">{zone.evacuated_percent}%</div>
          </div>
          <div>
            <div className="incident-hero-stat-label">Hazard</div>
            <div className="incident-hero-stat-value">{zone.hazard_level.toUpperCase()}</div>
          </div>
          <div>
            <div className="incident-hero-stat-label">Recommended Shelter</div>
            <div className="incident-hero-stat-value">{zone.recommended_shelter_name}</div>
          </div>
          <div>
            <div className="incident-hero-stat-label">Priority</div>
            <div className="incident-hero-stat-value">{zone.priority.toUpperCase()}</div>
          </div>
        </div>
      </div>

      <div className="route-panel-actions">
        <button type="button" className="op-button" onClick={onTogglePlan}>
          {planVisible ? "Hide Evacuation Plan" : "View Evacuation Plan"}
        </button>
      </div>

      {planVisible && (
        <div className="ov-row-detail">
          <div className="ov-row-detail-line">
            <span>Route to shelter</span>
            <span>{zone.recommended_shelter_name}</span>
          </div>
          <div className="ov-row-detail-line">
            <span>Distance</span>
            <span>{zone.plan_distance_miles.toFixed(1)} mi</span>
          </div>
          <div className="ov-row-detail-line">
            <span>ETA</span>
            <span>{zone.plan_eta_minutes} min</span>
          </div>
        </div>
      )}
    </OverviewPanel>
  );
}
