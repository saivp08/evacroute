"use client";

// InfrastructureLayer imports MapLibre-backed react-map-gl primitives that touch `window`
// at module load — so it must stay out of the server bundle, same as BaseMap/BaseMapLoader.
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type InfrastructureLayerType from "./InfrastructureLayer";

const InfrastructureLayer = dynamic(() => import("./InfrastructureLayer"), { ssr: false });

export default function InfrastructureLayerLoader(props: ComponentProps<typeof InfrastructureLayerType>) {
  return <InfrastructureLayer {...props} />;
}
