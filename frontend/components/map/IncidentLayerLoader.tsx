"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type IncidentLayerType from "./IncidentLayer";

const IncidentLayer = dynamic(() => import("./IncidentLayer"), { ssr: false });

export default function IncidentLayerLoader(props: ComponentProps<typeof IncidentLayerType>) {
  return <IncidentLayer {...props} />;
}
