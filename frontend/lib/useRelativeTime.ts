"use client";

// Small display utility: re-renders periodically so "time ago" text and formatted
// clocks visibly progress, communicating that the console is actively monitoring —
// not a data source, just a ticking clock for already-fetched timestamps.
import { useEffect, useState } from "react";

export function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function formatRelativeTime(isoTimestamp: string | null, now: number): string {
  if (!isoTimestamp) return "Not provided";
  const deltaSeconds = Math.max(0, Math.round((now - new Date(isoTimestamp).getTime()) / 1000));
  if (deltaSeconds < 60) return "just now";
  const minutes = Math.floor(deltaSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

export function formatClock(isoTimestamp: string | null): string {
  if (!isoTimestamp) return "Not provided";
  return new Date(isoTimestamp).toLocaleTimeString(undefined, { hour12: false });
}
