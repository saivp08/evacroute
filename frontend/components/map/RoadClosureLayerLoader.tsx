"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type RoadClosureLayerType from "./RoadClosureLayer";

const RoadClosureLayer = dynamic(() => import("./RoadClosureLayer"), { ssr: false });

export default function RoadClosureLayerLoader(props: ComponentProps<typeof RoadClosureLayerType>) {
  return <RoadClosureLayer {...props} />;
}
