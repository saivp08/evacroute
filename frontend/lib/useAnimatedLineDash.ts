"use client";

// Real directional-flow animation for MapLibre line layers using the standard "marching
// dashes" technique (the same recipe MapLibre's own official "Animate a line" example
// uses): line-dasharray has no offset/phase property to animate directly, so this cycles
// through a sequence of dasharray patterns on a single shared requestAnimationFrame loop.
// One rAF loop drives every layer passed in, so adding more animated routes doesn't add
// more render loops.
import { useEffect } from "react";
import type { MapRef } from "react-map-gl/maplibre";

// Each step nudges the dash pattern forward by half a dash-width; cycling through all of
// them reads as dashes flowing continuously in the line's own coordinate direction.
const DASH_SEQUENCE: number[][] = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
];

const STEP_MS = 55;

export function useAnimatedLineDash(map: MapRef | undefined, layerIds: string[]) {
  useEffect(() => {
    if (!map || layerIds.length === 0) return;
    const glMap = map.getMap();
    let raf = 0;
    let lastStep = -1;

    function tick(timestamp: number) {
      const step = Math.floor(timestamp / STEP_MS) % DASH_SEQUENCE.length;
      if (step !== lastStep) {
        lastStep = step;
        for (const id of layerIds) {
          if (glMap.getLayer(id)) {
            glMap.setPaintProperty(id, "line-dasharray", DASH_SEQUENCE[step]);
          }
        }
      }
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, layerIds.join(",")]);
}
