import type { ShelterAllocationDetail, ShelterAllocationStatus } from "@/lib/models";
import OverviewPanel from "@/components/overview/OverviewPanel";

// Reuses the existing "incident hero" treatment (see ActiveIncidentsPanel/Evacuation Zone
// Detail) so a featured shelter reads the same way a featured incident or zone does — same
// severity tiers, same colors, just one more application of the same visual language.
const STATUS_HERO_CLASS: Record<ShelterAllocationStatus, string> = {
  full: "incident-hero",
  near_capacity: "incident-hero incident-hero-warning",
  filling: "incident-hero incident-hero-caution",
  available: "incident-hero incident-hero-inactive",
};

const STATUS_LABEL: Record<ShelterAllocationStatus, string> = {
  available: "Available",
  filling: "Filling",
  near_capacity: "Near Capacity",
  full: "Full",
};

interface ShelterDetailPanelProps {
  shelter: ShelterAllocationDetail | null;
}

export default function ShelterDetailPanel({ shelter }: ShelterDetailPanelProps) {
  if (!shelter) {
    return (
      <OverviewPanel title="Shelter Detail">
        <p className="empty-note">Select a shelter to view allocation details.</p>
      </OverviewPanel>
    );
  }

  return (
    <OverviewPanel title="Shelter Detail">
      <div className={STATUS_HERO_CLASS[shelter.status]}>
        <span className="incident-hero-severity">{shelter.name.toUpperCase()}</span>
        <div className="incident-hero-title">Status: {STATUS_LABEL[shelter.status]}</div>
        <div className="incident-hero-grid">
          <div>
            <div className="incident-hero-stat-label">Capacity</div>
            <div className="incident-hero-stat-value">{shelter.total_capacity.toLocaleString()}</div>
          </div>
          <div>
            <div className="incident-hero-stat-label">Occupied</div>
            <div className="incident-hero-stat-value">{shelter.current_occupancy.toLocaleString()}</div>
          </div>
          <div>
            <div className="incident-hero-stat-label">Available</div>
            <div className="incident-hero-stat-value">{shelter.available_capacity.toLocaleString()}</div>
          </div>
          <div>
            <div className="incident-hero-stat-label">Incoming</div>
            <div className="incident-hero-stat-value">{shelter.incoming.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="ov-row-detail">
        <div className="ov-row-detail-line">
          <span>Assigned Zones</span>
          <span>{shelter.assigned_zone_codes.length > 0 ? shelter.assigned_zone_codes.join(", ") : "None"}</span>
        </div>
        <div className="ov-row-detail-line">
          <span>Congestion</span>
          <span>{shelter.congestion_level}</span>
        </div>
        <div className="ov-row-detail-line">
          <span>Hazard Exposure</span>
          <span>{shelter.hazard_exposure}</span>
        </div>
      </div>
    </OverviewPanel>
  );
}
