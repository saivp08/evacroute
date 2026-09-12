"use client";

import dynamic from "next/dynamic";

const EvacuationRouteLayer = dynamic(() => import("./EvacuationRouteLayer"), { ssr: false });

export default function EvacuationRouteLayerLoader() {
  return <EvacuationRouteLayer />;
}
