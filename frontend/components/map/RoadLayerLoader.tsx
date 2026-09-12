"use client";

import dynamic from "next/dynamic";

const RoadLayer = dynamic(() => import("./RoadLayer"), { ssr: false });

export default function RoadLayerLoader() {
  return <RoadLayer />;
}
