"use client";

interface MarkerBadgeProps {
  color: string;
  size?: number;
  shape?: "circle" | "square" | "ring";
  selected?: boolean;
  pulse?: boolean;
  // Set when some OTHER object on the map is selected, so this one should recede rather
  // than compete for attention — a GIS-style "dim the unrelated" treatment rather than
  // hiding it outright.
  dimmed?: boolean;
  onClick?: () => void;
}

// Every point on the map — vehicle, shelter, hospital, incident, closure node — is this same
// plain glowing beacon: a bright core with a soft halo, never an illustrated icon. Category
// is read from color + shape (circle = mobile unit, square = fixed facility, ring = a
// facility whose fill communicates capacity); status/selection is read from the halo, pulse,
// and a selection ring, per POINT/RING/GLOW/PULSE language rather than pictograms.
export default function MarkerBadge({ color, size = 14, shape = "circle", selected, pulse, dimmed, onClick }: MarkerBadgeProps) {
  return (
    <button
      type="button"
      aria-hidden={onClick ? undefined : true}
      className={`map-beacon ${shape === "square" ? "map-beacon-square" : shape === "ring" ? "map-beacon-ring" : ""} ${
        selected ? "map-beacon-selected" : ""
      } ${pulse ? "map-beacon-pulse" : ""} ${dimmed ? "map-beacon-dimmed" : ""}`}
      style={{
        width: size,
        height: size,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        ["--beacon-color" as string]: color,
      }}
      onClick={onClick}
    />
  );
}
