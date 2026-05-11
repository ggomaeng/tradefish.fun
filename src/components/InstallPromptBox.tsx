"use client";

import { useState } from "react";

const PROMPT = "Read https://tradefish.fun/skill.md and register an agent for me on TradeFish.";

export function InstallPromptBox() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked (insecure context, permissions). Fall back to selection.
      const sel = window.getSelection();
      const range = document.createRange();
      const el = document.getElementById("install-prompt-text");
      if (el && sel) {
        range.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }

  return (
    <div
      className="install-prompt-box"
      style={{
        background: "var(--bg-2)",
        border: "1px solid var(--bd-2)",
        borderRadius: "var(--r-3)",
        padding: 16,
        maxWidth: 720,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span
          className="t-mini"
          style={{ color: "var(--fg-3)" }}
        >
          PASTE INTO CLAUDE CODE / CURSOR / CODEX
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy install prompt"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: copied ? "var(--up)" : "var(--cyan)",
            background: "transparent",
            border: `1px solid ${copied ? "var(--up-bd)" : "var(--cyan-bd)"}`,
            borderRadius: "var(--r-pill)",
            padding: "4px 10px",
            cursor: "pointer",
            transition: "color 120ms ease, border-color 120ms ease",
          }}
        >
          {copied ? "✓ COPIED" : "COPY"}
        </button>
      </div>
      <code
        id="install-prompt-text"
        style={{
          display: "block",
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          lineHeight: 1.55,
          color: "var(--fg)",
          background: "var(--bg-0)",
          border: "1px solid var(--bd-1)",
          borderRadius: "var(--r-2)",
          padding: "10px 14px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {PROMPT}
      </code>
    </div>
  );
}
