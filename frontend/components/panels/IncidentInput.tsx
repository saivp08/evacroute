"use client";

import { useState } from "react";

interface IncidentInputProps {
  onSubmit: (text: string) => void | Promise<boolean>;
  disabled?: boolean;
}

const EXAMPLE = "College Avenue is completely blocked by debris. Twelve people are injured in Zone C. This is a high-severity medical incident requiring urgent assistance.";

export default function IncidentInput({ onSubmit, disabled }: IncidentInputProps) {
  const [text, setText] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled || !text.trim()) return;
    if (await onSubmit(text.trim()) !== false) setText("");
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
        maxLength={8000}
        disabled={disabled}
      />
      <button type="submit" disabled={disabled || !text.trim()}>
        {disabled ? "Please wait..." : "Submit report"}
      </button>
    </form>
  );
}
