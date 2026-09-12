"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type EvacuationZoneLayerType from "./EvacuationZoneLayer";

const EvacuationZoneLayer = dynamic(() => import("./EvacuationZoneLayer"), { ssr: false });

export default function EvacuationZoneLayerLoader(props: ComponentProps<typeof EvacuationZoneLayerType>) {
  return <EvacuationZoneLayer {...props} />;
}
