"use client";

// Lets the Report Incident form capture a real map location — either an explicit "Pick on
// Map" click, or a fast right-click-anywhere shortcut. Renders nothing; it only attaches
// map event listeners. Marker layers already call stopPropagation() on their own "click"
// handlers, so a plain map-level "click" listener here only ever fires for empty-map clicks,
// never steals a marker's own selection click.
import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";
import type { MapMouseEvent } from "maplibre-gl";

interface MapClickCaptureProps {
  // Only armed while the incident form's "Pick on Map" mode is on — a plain left-click
  // elsewhere on the map should keep doing whatever it already does (selecting nothing,
  // dismissing the inspector, etc).
  pickModeActive: boolean;
  onPick: (lat: number, lng: number) => void;
}

export default function MapClickCapture({ pickModeActive, onPick }: MapClickCaptureProps) {
  const { current: map } = useMap();

  useEffect(() => {
    if (!map) return;

    function handleClick(e: MapMouseEvent) {
      if (!pickModeActive) return;
      onPick(e.lngLat.lat, e.lngLat.lng);
    }

    // Right-click always works, independent of pick mode — the fast "report incident here"
    // shortcut the map itself offers.
    function handleContextMenu(e: MapMouseEvent) {
      e.preventDefault();
      onPick(e.lngLat.lat, e.lngLat.lng);
    }

    map.on("click", handleClick);
    map.on("contextmenu", handleContextMenu);
    return () => {
      map.off("click", handleClick);
      map.off("contextmenu", handleContextMenu);
    };
  }, [map, pickModeActive, onPick]);

  return null;
}
