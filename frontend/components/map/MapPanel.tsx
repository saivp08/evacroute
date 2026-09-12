"use client";

import dynamic from "next/dynamic";
import type { ScenarioState } from "@/lib/types";

const EvacMap = dynamic(() => import("./EvacMap"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading map...</div>,
});

interface MapPanelProps {
  scenario: ScenarioState;
  center: [number, number];
  changedZoneIds?: Set<string>;
}

export default function MapPanel(props: MapPanelProps) {
  return <EvacMap {...props} />;
}
