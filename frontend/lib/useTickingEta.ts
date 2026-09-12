"use client";

// Ticks vehicle ETA down locally so the console visibly reflects time passing, without
// touching the data/service architecture — each consumer of getVehicles() still fetches
// independently; this just animates whatever it received.
import { useEffect, useState } from "react";
import type { Vehicle } from "./models";

export function useTickingEta(vehicles: Vehicle[], intervalMs = 12000): Vehicle[] {
  const [ticked, setTicked] = useState(vehicles);

  useEffect(() => {
    setTicked(vehicles);
  }, [vehicles]);

  useEffect(() => {
    const id = setInterval(() => {
      setTicked((prev) =>
        prev.map((v) => (v.eta_minutes !== null && v.eta_minutes > 0 ? { ...v, eta_minutes: v.eta_minutes - 1 } : v))
      );
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return ticked;
}
