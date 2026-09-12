"use client";

// Application-wide dark/light mode. Two intentionally-designed palettes live in
// app/globals.css as CSS custom properties gated by [data-theme] on <html>; this hook just
// owns which one is active and persists the choice (no existing settings/preferences store
// to hook into, so localStorage is the persistence layer).
import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "dark" | "light";

const STORAGE_KEY = "evacroute-theme";
// Every component calls useTheme() independently (BaseMap, ThemeToggle, every map layer's
// getMapPalette(theme) call) — each owns its own useState, so without a shared signal only
// the instance that actually clicked the toggle would re-render; every other one (e.g. the
// map, whose basemap filter and marker palette both depend on theme) would keep rendering
// its stale initial value until a full page reload. A same-tab custom event (the "storage"
// event only fires in OTHER tabs) is enough to keep every instance in sync without lifting
// this into a context provider.
const THEME_EVENT = "evacroute:theme-change";

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    setThemeState(readStoredTheme());
    const handleChange = () => setThemeState(readStoredTheme());
    window.addEventListener(THEME_EVENT, handleChange);
    return () => window.removeEventListener(THEME_EVENT, handleChange);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing / storage disabled — theme still applies for this session.
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
