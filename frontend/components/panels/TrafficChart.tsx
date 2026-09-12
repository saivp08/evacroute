import type { TrafficData } from "@/lib/types";

const WIDTH = 320;
const HEIGHT = 110;
const PAD = 24;
const MAX_MINUTE = 24 * 60;

function pathFor(points: { minuteOfDay?: number; avgSpeedKmh: number | null }[], maxSpeed: number) {
  const valid = points.filter(
    (p): p is { minuteOfDay: number; avgSpeedKmh: number } => p.avgSpeedKmh !== null && p.minuteOfDay !== undefined
  );
  if (valid.length === 0) return "";
  return valid
    .map((p, i) => {
      const x = PAD + (p.minuteOfDay / MAX_MINUTE) * (WIDTH - PAD * 1.5);
      const y = HEIGHT - PAD - (p.avgSpeedKmh / maxSpeed) * (HEIGHT - PAD * 1.5);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function TrafficChart({ traffic }: { traffic: TrafficData }) {
  const firstEvacDate = traffic.evacuation.length > 0 ? new Date(traffic.evacuation[0].time!) : null;
  const firstEvacDay = firstEvacDate?.getUTCDate() ?? null;
  const dayOneEvac = traffic.evacuation
    .filter((p) => new Date(p.time!).getUTCDate() === firstEvacDay)
    .map((p) => ({ minuteOfDay: new Date(p.time!).getUTCHours() * 60 + new Date(p.time!).getUTCMinutes(), avgSpeedKmh: p.avgSpeedKmh }));
  const evacDateLabel = firstEvacDate
    ? firstEvacDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    : "evacuation day";

  const allSpeeds = [...traffic.routineByTimeOfDay, ...dayOneEvac]
    .map((p) => p.avgSpeedKmh)
    .filter((s): s is number => s !== null);
  const maxSpeed = Math.max(...allSpeeds, 10) * 1.1;

  return (
    <section className="panel-section">
      <h2>Evacuation Corridor Congestion</h2>
      <p className="empty-note">{traffic.corridor} &middot; {traffic.detectorCount} Caltrans PeMS detectors</p>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="traffic-chart" role="img" aria-label="Corridor speed: evacuation day vs routine baseline">
        <line x1={PAD} y1={HEIGHT - PAD} x2={WIDTH - 6} y2={HEIGHT - PAD} stroke="#334155" strokeWidth={1} />
        <path d={pathFor(traffic.routineByTimeOfDay, maxSpeed)} fill="none" stroke="#64748b" strokeWidth={1.5} strokeDasharray="3 3" />
        <path d={pathFor(dayOneEvac, maxSpeed)} fill="none" stroke="#f97316" strokeWidth={2} />
        <text x={PAD} y={12} fill="#94a3b8" fontSize={9}>km/h</text>
      </svg>
      <div className="chart-legend">
        <span><i className="legend-swatch" style={{ background: "#f97316" }} /> Evacuation day ({evacDateLabel})</span>
        <span><i className="legend-swatch" style={{ background: "#64748b" }} /> Routine baseline</span>
      </div>
    </section>
  );
}
