"use client";

import dynamic from "next/dynamic";

const HazardLayer = dynamic(() => import("./HazardLayer"), { ssr: false });

export default function HazardLayerLoader() {
  return <HazardLayer />;
}
