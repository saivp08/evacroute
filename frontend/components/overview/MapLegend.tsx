"use client";

// Compact, always-visible key for the map's semantic colors/symbols — so a viewer doesn't
// have to be told what teal vs. amber vs. red means on first glance.
export default function MapLegend() {
  return (
    <div className="map-legend">
      <div className="map-legend-row">
        <span className="map-legend-swatch map-legend-line" style={{ background: "var(--active)" }} />
        Evacuation Route
      </div>
      <div className="map-legend-row">
        <span className="map-legend-swatch map-legend-line" style={{ background: "var(--warning)" }} />
        Emergency Response
      </div>
      <div className="map-legend-row">
        <span className="map-legend-swatch map-legend-line" style={{ background: "var(--danger)" }} />
        Blocked Road
      </div>
      <div className="map-legend-row">
        <span className="map-legend-swatch map-legend-dot" style={{ background: "var(--caution)" }} />
        Evacuation Zone
      </div>
      <div className="map-legend-row">
        <span className="map-legend-swatch map-legend-dot" style={{ background: "var(--success)" }} />
        Shelter
      </div>
      <div className="map-legend-row">
        <span className="map-legend-swatch map-legend-dot" style={{ background: "var(--danger)" }} />
        Active Incident
      </div>
    </div>
  );
}
