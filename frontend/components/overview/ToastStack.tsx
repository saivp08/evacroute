"use client";

// Small, non-interrupting notifications for non-critical real events (see
// lib/useLiveEvents.ts) — auto-dismiss after a few seconds. Content is the event's own
// real fields, never invented copy.
import { useEffect } from "react";
import type { OperationalEvent } from "@/lib/models";

const TOAST_TTL_MS = 6000;
const KIND_GLYPH: Record<OperationalEvent["kind"], string> = {
  incident: "▲",
  closure: "⛔",
  shelter: "⌂",
  vehicle: "▣",
};

interface ToastStackProps {
  toasts: (OperationalEvent & { toastId: string })[];
  onDismiss: (toastId: string) => void;
}

export default function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <Toast key={toast.toastId} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Toast({ toast, onDismiss }: { toast: OperationalEvent & { toastId: string }; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const id = setTimeout(() => onDismiss(toast.toastId), TOAST_TTL_MS);
    return () => clearTimeout(id);
  }, [toast.toastId, onDismiss]);

  return (
    <div className={`toast toast-${toast.severity}`}>
      <span className="toast-glyph" aria-hidden="true">
        {KIND_GLYPH[toast.kind]}
      </span>
      <span className="toast-message">{toast.message}</span>
    </div>
  );
}
