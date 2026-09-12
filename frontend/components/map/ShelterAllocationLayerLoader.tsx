"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type ShelterAllocationLayerType from "./ShelterAllocationLayer";

const ShelterAllocationLayer = dynamic(() => import("./ShelterAllocationLayer"), { ssr: false });

export default function ShelterAllocationLayerLoader(props: ComponentProps<typeof ShelterAllocationLayerType>) {
  return <ShelterAllocationLayer {...props} />;
}
