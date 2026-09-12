"use client";

// VehicleLayer imports MapLibre-backed react-map-gl primitives that touch `window` at
// module load — keep it out of the server bundle, same as the other layers.
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type VehicleLayerType from "./VehicleLayer";

const VehicleLayer = dynamic(() => import("./VehicleLayer"), { ssr: false });

export default function VehicleLayerLoader(props: ComponentProps<typeof VehicleLayerType>) {
  return <VehicleLayer {...props} />;
}
