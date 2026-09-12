import type { Metrics } from "@/lib/types";

export default function TopBar({ metrics }: { metrics: Metrics }) {
  return (
    <header className="top-bar">
      <div className="top-bar-title">
        <h1>EvacRoute</h1>
        <span className="top-bar-subtitle">Santa Rosa / Sonoma County &middot; Kincade Fire (Oct 2019) reference scenario</span>
      </div>
      <div className="metrics-row">
        <Metric label="Population in zones" value={metrics.totalPopulation.toLocaleString()} />
        <Metric label="Zones evacuating" value={String(metrics.zonesEvacuating)} />
        <Metric label="Zones critical" value={String(metrics.zonesCritical)} tone={metrics.zonesCritical > 0 ? "critical" : undefined} />
        <Metric
          label="Shelter capacity used"
          value={`${metrics.shelterCapacityAssigned.toLocaleString()} / ${metrics.totalShelterCapacity.toLocaleString()}`}
        />
        <Metric label="Active response units" value={String(metrics.activeAmbulances)} />
      </div>
    </header>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "critical" }) {
  return (
    <div className={`metric ${tone === "critical" ? "metric-critical" : ""}`}>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
}
