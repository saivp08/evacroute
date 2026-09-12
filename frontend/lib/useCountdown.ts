"use client";

// Ticks a whole-minute ETA down to the second for a dispatch-style "MM:SS" display. Purely
// cosmetic/local — it does not mutate the underlying route data, and resets whenever the
// seed (a new vehicle's ETA) changes.
import { useEffect, useState } from "react";

export function useCountdownSeconds(initialMinutes: number | null): number | null {
  const [seconds, setSeconds] = useState<number | null>(initialMinutes === null ? null : initialMinutes * 60);

  useEffect(() => {
    setSeconds(initialMinutes === null ? null : initialMinutes * 60);
  }, [initialMinutes]);

  useEffect(() => {
    if (seconds === null || seconds <= 0) return;
    const id = setInterval(() => {
      setSeconds((s) => (s === null ? null : Math.max(0, s - 1)));
    }, 1000);
    return () => clearInterval(id);
  }, [seconds === null]);

  return seconds;
}

export function formatMinSec(totalSeconds: number | null): string {
  if (totalSeconds === null) return "—";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
