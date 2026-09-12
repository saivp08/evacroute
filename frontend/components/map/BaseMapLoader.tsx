"use client";

// MapLibre GL touches `window`/WebGL, so it can only render client-side. This wrapper is
// what consumers of BaseMap should actually import.
import dynamic from "next/dynamic";
import type { BaseMapProps } from "./BaseMap";

const BaseMap = dynamic(() => import("./BaseMap"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading map…</div>,
});

export default function BaseMapLoader(props: BaseMapProps) {
  return <BaseMap {...props} />;
}
