import { useState } from "react";
import type { Shelter } from "@/lib/models";
import { SHELTER_SHAPE, shapeClassName } from "@/lib/entitySymbols";
import OverviewPanel from "./OverviewPanel";

const NEAR_CAPACITY_PCT = 70;

function occupancyPct(shelter: Shelter): number {
  return shelter.capacity > 0 ? Math.round((shelter.occupancy / shelter.capacity) * 100) : 0;
}

function dotClass(pct: number): string {
  if (pct >= 95) return "dot-critical";
  if (pct >= NEAR_CAPACITY_PCT) return "dot-caution";
  return "dot-safe";
}

interface ShelterCapacityPanelProps {
  shelters: Shelter[];
  selectedShelterId: string | null;
  onSelectShelter: (id: string) => void;
}

// Every real shelter stays individually reachable here — no "top 5 + N more" cap. Urgency
// sort keeps the ones that matter most at the top of the (scrollable) list; the search box
// exists only because 28 real FEMA shelters is enough that finding one by name benefits
// from it, not to gate access to any of them.
export default function ShelterCapacityPanel({ shelters, selectedShelterId, onSelectShelter }: ShelterCapacityPanelProps) {
  const [query, setQuery] = useState("");

  if (shelters.length === 0) {
    return (
      <OverviewPanel title="Shelters" count={0}>
        <p className="rail-empty">No shelter data available.</p>
      </OverviewPanel>
    );
  }

  const nearCapacityCount = shelters.filter((s) => occupancyPct(s) >= NEAR_CAPACITY_PCT).length;
  const sorted = [...shelters].sort((a, b) => occupancyPct(b) - occupancyPct(a));
  const filtered = query.trim() ? sorted.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase())) : sorted;

  return (
    <OverviewPanel title="Shelters" count={shelters.length} subtitle={nearCapacityCount > 0 ? `${nearCapacityCount} near capacity` : "All clear"}>
      {shelters.length > 5 && (
        <input
          type="text"
          className="rail-search"
          placeholder="Search shelters…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <ul className="rail-list rail-list-tall">
        {filtered.map((shelter) => {
          const pct = occupancyPct(shelter);
          return (
            <li key={shelter.id}>
              <button
                type="button"
                className={`rail-row ${shelter.id === selectedShelterId ? "rail-row-selected" : ""}`}
                onClick={() => onSelectShelter(shelter.id)}
              >
                <span className={`rail-row-glyph ${shapeClassName(SHELTER_SHAPE)}`} aria-hidden="true" />
                <span className="rail-row-text">{shelter.name}</span>
                <span className="rail-row-meta">{pct}%</span>
                <span className={`ov-dot ${dotClass(pct)}`} aria-hidden="true" />
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && <li className="rail-empty">No shelters match &ldquo;{query}&rdquo;.</li>}
      </ul>
    </OverviewPanel>
  );
}
