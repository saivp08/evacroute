"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getHealth, getScenario, optimize, parseReport, resetIncidents } from "./dataService";
import { normalizeScenario } from "./normalize";
import type { ParseResponse, PlanResponse, ScenarioResponse } from "./apiTypes";

function useOperationsState() {
  const [scenario, setScenario] = useState<ScenarioResponse | null>(null);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [busy, setBusy] = useState<string | null>("Loading scenario");
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const execute = useCallback(async (label: string, work: () => Promise<void>) => {
    if (locked.current) return false;
    locked.current = true;
    setBusy(label);
    setError(null);
    try { await work(); return true; }
    catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : "Request failed."); return false; }
    finally { locked.current = false; if (mounted.current) setBusy(null); }
  }, []);
  const load = useCallback(async () => {
    const current = ++generation.current;
    setBusy("Loading scenario");
    setError(null);
    locked.current = true;
    try {
      const [health, nextScenario] = await Promise.all([getHealth(), getScenario()]);
      if (health.status !== "ok") throw new Error("Backend health check failed.");
      normalizeScenario(nextScenario, null);
      if (!mounted.current || current !== generation.current) return;
      setScenario(nextScenario);
      // Restore an existing server plan on refresh; optimization does not mutate incidents.
      const nextPlan = await optimize();
      if (mounted.current && current === generation.current) setPlan(nextPlan);
    } catch (error) {
      if (mounted.current && current === generation.current) setError(error instanceof Error ? error.message : "Unable to load scenario.");
    } finally {
      if (mounted.current && current === generation.current) { locked.current = false; setBusy(null); }
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; generation.current++; };
  }, [load]);
  const data = useMemo(() => scenario ? normalizeScenario(scenario, plan) : null, [scenario, plan]);
  return {
    data, scenario, plan, parsed, busy, error, reload: load,
    runOptimization: () => execute("Optimizing routes", async () => { setPlan(await optimize()); }),
    submitReport: (report: string) => execute("Parsing report and replanning", async () => {
      const result = await parseReport(report);
      setPlan(result); setParsed(result);
    }),
    reset: () => execute("Resetting incidents", async () => { setPlan(await resetIncidents()); setParsed(null); }),
  };
}
const OperationsContext = createContext<ReturnType<typeof useOperationsState> | null>(null);
export function OperationsProvider({ children }: { children: ReactNode }) {
  const value = useOperationsState();
  return <OperationsContext.Provider value={value}>{children}</OperationsContext.Provider>;
}
export function useOperations() {
  const value = useContext(OperationsContext);
  if (!value) throw new Error("OperationsProvider is missing.");
  return value;
}
