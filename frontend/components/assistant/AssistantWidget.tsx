"use client";

// Floating operations assistant — a real chat, not a static mock. Every reply comes from
// POST /assistant/chat (backend/app/assistant/), which is grounded in the same live
// scenario/plan state the rest of the app reads; nothing here is answered from generic
// model knowledge or invented client-side.
import { useEffect, useRef, useState } from "react";
import {
  sendAssistantMessage,
  type AssistantChatTurn,
  type AssistantReference,
} from "@/lib/services/backendClient";
import type { Selection } from "@/lib/selection";

interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  references?: AssistantReference[];
}

const QUICK_PROMPTS = [
  "What's happening?",
  "Current incidents",
  "Traffic hotspots",
  "Emergency fleet",
  "Shelter status",
  "Simulation summary",
];

const UNAVAILABLE_MESSAGE = "Assistant unavailable right now.";

interface AssistantWidgetProps {
  onViewReference: (kind: Selection["kind"], id: string) => void;
}

export default function AssistantWidget({ onViewReference }: AssistantWidgetProps) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [entries, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;

    const history: AssistantChatTurn[] = entries.map((e) => ({ role: e.role, content: e.content }));
    setEntries((prev) => [...prev, { id: `${Date.now()}-u`, role: "user", content: message }]);
    setInput("");
    setBusy(true);

    try {
      const result = await sendAssistantMessage(message, history);
      setEntries((prev) => [
        ...prev,
        { id: `${Date.now()}-a`, role: "assistant", content: result.reply, references: result.references },
      ]);
    } catch {
      setEntries((prev) => [...prev, { id: `${Date.now()}-e`, role: "assistant", content: UNAVAILABLE_MESSAGE }]);
    } finally {
      setBusy(false);
    }
  }

  function handleViewReference(ref: AssistantReference) {
    onViewReference(ref.kind, ref.id);
    setOpen(false);
  }

  return (
    <div className="assistant-root">
      {open && (
        <div className="assistant-panel">
          <div className="assistant-panel-header">
            <span className="assistant-panel-title">EvacRoute Assistant</span>
            <button type="button" className="assistant-close" onClick={() => setOpen(false)} aria-label="Close assistant">
              ✕
            </button>
          </div>

          <div className="assistant-messages" ref={scrollRef}>
            {entries.length === 0 && (
              <div className="assistant-quick-prompts">
                <p className="assistant-empty-hint">Ask about the current operation.</p>
                {QUICK_PROMPTS.map((prompt) => (
                  <button key={prompt} type="button" className="assistant-quick-prompt" onClick={() => send(prompt)}>
                    {prompt.toUpperCase()}
                  </button>
                ))}
              </div>
            )}

            {entries.map((entry) => (
              <div key={entry.id} className={`assistant-message assistant-message-${entry.role}`}>
                <div className="assistant-message-bubble">{entry.content}</div>
                {entry.references && entry.references.length > 0 && (
                  <div className="assistant-references">
                    {entry.references.map((ref) => (
                      <button
                        key={`${ref.kind}-${ref.id}`}
                        type="button"
                        className="assistant-reference-button"
                        onClick={() => handleViewReference(ref)}
                      >
                        View on Map — {ref.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {busy && (
              <div className="assistant-message assistant-message-assistant">
                <div className="assistant-message-bubble assistant-message-typing">Thinking…</div>
              </div>
            )}
          </div>

          <form
            className="assistant-input-row"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              type="text"
              className="assistant-input"
              placeholder="Ask the assistant…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />
            <button type="submit" className="assistant-send" disabled={busy || input.trim().length === 0}>
              Send
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className="assistant-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close EvacRoute assistant" : "Open EvacRoute assistant"}
      >
        <span className="assistant-fab-dot" aria-hidden="true" />
        EV
      </button>
    </div>
  );
}
