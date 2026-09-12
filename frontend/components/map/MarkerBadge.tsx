"use client";

import type { ReactNode } from "react";

interface MarkerBadgeProps {
  color: string;
  size?: number;
  shape?: "circle" | "square";
  selected?: boolean;
  pulse?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

// Shared wrapper for every point marker on the map (vehicles, shelters, hospitals,
// incidents, closures) — gives them all the same status-colored badge + selected-state
// scale-up + optional pulse, while the actual icon inside (components/map/icons.tsx)
// differs per entity type so they stay visually distinguishable.
export default function MarkerBadge({ color, size = 30, shape = "circle", selected, pulse, onClick, children }: MarkerBadgeProps) {
  return (
    <button
      type="button"
      className={`map-marker-badge ${shape === "square" ? "map-marker-badge-square" : ""} ${
        selected ? "map-marker-badge-selected" : ""
      } ${pulse ? "map-marker-badge-pulse" : ""}`}
      style={{ background: color, width: size, height: size }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
