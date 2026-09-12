"use client";

// Mock "Recommend Shelter" interaction: pick an evacuation zone, get 2-3 ranked shelters.
//   panel component -> lib/services/dataService -> deterministic mock ranking
// The ranking is a fixed heuristic blend (capacity/distance/congestion/hazard) computed in
// getShelterRecommendations — not a real assignment/optimization algorithm.
import { useEffect, useState } from "react";
import type { EvacuationZoneDetail, ShelterRecommendation } from "@/lib/models";
import { getEvacuationZoneDetails, getShelterRecommendations } from "@/lib/services/dataService";
import OverviewPanel from "@/components/overview/OverviewPanel";

export default function RecommendShelterPanel() {
  const [zones, setZones] = useState<EvacuationZoneDetail[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [recommendations, setRecommendations] = useState<ShelterRecommendation[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getEvacuationZoneDetails().then((data) => {
      if (cancelled) return;
      setZones(data);
      if (data.length > 0) setSelectedZoneId(data[0].id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRecommend() {
    if (!selectedZoneId) return;
    setLoading(true);
    const result = await getShelterRecommendations(selectedZoneId);
    setRecommendations(result);
    setLoading(false);
  }

  return (
    <OverviewPanel title="Recommend Shelter">
      <div className="recommend-shelter-controls">
        <select
          className="recommend-shelter-select"
          value={selectedZoneId}
          onChange={(event) => {
            setSelectedZoneId(event.target.value);
            setRecommendations(null);
          }}
        >
          {zones.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.name}
            </option>
          ))}
        </select>
        <button type="button" className="op-button" onClick={handleRecommend} disabled={!selectedZoneId || loading}>
          {loading ? "Ranking…" : "Recommend Shelter"}
        </button>
      </div>

      {recommendations &&
        (recommendations.length === 0 ? (
          <p className="empty-note">No shelters available to recommend.</p>
        ) : (
          <ul className="ov-list">
            {recommendations.map((rec) => (
              <li key={rec.shelter_id} className="ov-row">
                <span className="recommend-shelter-rank">#{rec.rank}</span>
                <div className="ov-row-main">
                  <div className="ov-row-title">
                    {rec.shelter_name}
                    <span className="ov-row-tag">Score {rec.score}</span>
                  </div>
                  <div className="ov-row-sub">
                    {rec.available_capacity.toLocaleString()} available · {rec.distance_miles.toFixed(1)} mi ·{" "}
                    {rec.congestion_level} congestion · {rec.hazard_exposure} hazard
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ))}
    </OverviewPanel>
  );
}
