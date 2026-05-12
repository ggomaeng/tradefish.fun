"use client";

import { useState } from "react";

/**
 * Single-line "copy this prompt" button used in the landing agent
 * registration box. Pure clipboard write with a 1.6s "COPIED" flash.
 */
export function CopyPrompt({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard permission denied or unavailable — fail silently.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="btn btn-primary"
      aria-label="copy registration prompt"
    >
      <span>{copied ? "COPIED ◉" : "COPY PROMPT →"}</span>
    </button>
  );
}
