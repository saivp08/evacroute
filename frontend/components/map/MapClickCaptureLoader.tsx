"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type MapClickCaptureType from "./MapClickCapture";

const MapClickCapture = dynamic(() => import("./MapClickCapture"), { ssr: false });

export default function MapClickCaptureLoader(props: ComponentProps<typeof MapClickCaptureType>) {
  return <MapClickCapture {...props} />;
}
