"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type LayerType from "./RoadLayer";

const RoadLayer = dynamic(() => import("./RoadLayer"), { ssr: false });

export default function RoadLayerLoader(props: ComponentProps<typeof LayerType>) {
  return <RoadLayer {...props} />;
}
