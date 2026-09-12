"use client";

import { useState } from "react";

interface IncidentInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

const EXAMPLE = "Wildfire shifted east. Highway 12 is blocked by debris and injuries were reported in Tract 1517.01.";

export default function IncidentInput({ onSubmit, disabled }: IncidentInputProps) {
  const [text, setText] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit(text.trim());
    setText("");
  }

  return (
    <form className="incident-form" onSubmit={handleSubmit}>
      <label htmlFor="incident-text">Report an emergency update</label>
      <textarea
        id="incident-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={EXAMPLE}
        rows={3}
        disabled={disabled}
      />
      <button type="submit" disabled={disabled || !text.trim()}>
        Submit report
      </button>
    </form>
  );
}
