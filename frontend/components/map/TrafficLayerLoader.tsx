"use client";

import dynamic from "next/dynamic";

const TrafficLayer = dynamic(() => import("./TrafficLayer"), { ssr: false });

export default function TrafficLayerLoader() {
  return <TrafficLayer />;
}
