"use client";

// Unified "investigate" surface for incidents, closures, shelters, and evacuation zones —
// a floating drawer over the map rather than another rounded card in the rail (vehicles
// already have their own contextual panel: see RoutePanel). Every field is read straight
// off the already-fetched, backend-derived entity; anything the backend doesn't provide
// shows "Unavailable" instead of a fabricated value.
import type { EvacuationZone, Incident, RoadClosure, Shelter } from "@/lib/models";
import { formatClock } from "@/lib/useRelativeTime";
import type { SelectionState } from "@/lib/selection";

interface ContextDrawerProps {
  selection: SelectionState;
  incidents: Incident[];
  closures: RoadClosure[];
  shelters: Shelter[];
  zones: EvacuationZone[];
  onClose: () => void;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="incident-hero-stat-label">{label}</div>
      <div className="incident-hero-stat-value">{value}</div>
    </div>
  );
}

export default function ContextDrawer({ selection, incidents, closures, shelters, zones, onClose }: ContextDrawerProps) {
  if (!selection || selection.kind === "vehicle") return null;

  let title: string;
  let subtitle: string;
  let stats: { label: string; value: string | number }[];

  if (selection.kind === "incident") {
    const incident = incidents.find((i) => i.id === selection.id);
    if (!incident) return null;
    title = incident.type.replace(/_/g, " ");
    subtitle = `${incident.severity} severity`;
    stats = [
      { label: "Status", value: incident.status.replace(/_/g, " ") },
      { label: "Zone", value: incident.zone_id ?? "Unavailable" },
      { label: "Reported", value: formatClock(incident.reported_at) },
    ];
  } else if (selection.kind === "closure") {
    const closure = closures.find((c) => c.id === selection.id);
    if (!closure) return null;
    title = closure.road_name;
    subtitle = closure.reason;
    stats = [
      { label: "Severity", value: closure.severity },
      { label: "Status", value: closure.status },
      { label: "Reported", value: formatClock(closure.reported_at) },
    ];
  } else if (selection.kind === "shelter") {
    const shelter = shelters.find((s) => s.id === selection.id);
    if (!shelter) return null;
    const available = Math.max(0, shelter.capacity - shelter.occupancy);
    title = shelter.name;
    subtitle = shelter.address || "Unavailable";
    stats = [
      { label: "Status", value: shelter.status },
      { label: "Occupied", value: `${shelter.occupancy.toLocaleString()} / ${shelter.capacity.toLocaleString()}` },
      { label: "Available", value: available.toLocaleString() },
    ];
  } else {
    const zone = zones.find((z) => z.id === selection.id);
    if (!zone) return null;
    title = zone.name;
    subtitle = `${zone.status} evacuation order`;
    stats = [
      { label: "Population", value: zone.population.toLocaleString() },
      { label: "Order", value: zone.status },
    ];
  }

  return (
    <div className="context-drawer">
      <button type="button" className="context-drawer-close" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <div className="context-drawer-title">{title}</div>
      <div className="context-drawer-subtitle">{subtitle}</div>
      <div className="incident-hero-grid context-drawer-grid">
        {stats.map((stat) => (
          <Stat key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>
    </div>
  );
}
