"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SUPPORTED_TOKENS, type SupportedToken } from "@/lib/supported-tokens";

/**
 * Landing hero ask input — single free-form text field with a sharp-cornered
 * spectrum CTA. Backend contract is unchanged from the previous landing: on
 * submit we soft-parse the typed text for a token symbol (e.g. "$SOL" or
 * "SOL") and POST { token_mint, question_type: "buy_sell_now" } per
 * AGENTS.md. The raw question is currently discarded.
 *
 * Design v3: sharp corners, mono caps, cyan focus glow, spectrum CTA. The
 * old typewriter + swarm-attention events were dropped with the ocean hero.
 */

const DEFAULT_SYMBOL = "SOL";
const PLACEHOLDER = "should i long $SOL for the next 4h?";

function findTokenBySymbol(symbol: string): SupportedToken | undefined {
  const u = symbol.trim().toUpperCase();
  return SUPPORTED_TOKENS.find((t) => t.symbol === u);
}

function extractToken(text: string): SupportedToken | null {
  if (!text) return null;
  const dollar = text.match(/\$([A-Za-z]{2,6})\b/);
  if (dollar) {
    const t = findTokenBySymbol(dollar[1]);
    if (t) return t;
  }
  for (const t of SUPPORTED_TOKENS) {
    const re = new RegExp(`\\b${t.symbol}\\b`, "i");
    if (re.test(text)) return t;
  }
  return null;
}

export function HeroAsk() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const defaultToken = findTokenBySymbol(DEFAULT_SYMBOL) ?? SUPPORTED_TOKENS[0];

  const submit = async (): Promise<void> => {
    if (submitting) return;
    const t = extractToken(query) ?? defaultToken;
    if (!t) return;
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch("/api/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token_mint: t.mint,
          question_type: "buy_sell_now",
        }),
      });
      const json = (await r.json()) as { query_id?: string; error?: string };
      if (!r.ok) throw new Error(json.error ?? "submit_failed");
      router.push(`/round/${json.query_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "submit_failed");
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[640px] flex flex-col items-stretch gap-3">
      <div
        className="flex items-stretch"
        style={{
          background: "var(--surface)",
          border: `1px solid ${focused ? "var(--cyan)" : "var(--line-strong)"}`,
          boxShadow: focused
            ? "0 0 0 1px var(--cyan), var(--glow-cyan)"
            : "none",
          transition:
            "border-color var(--t-fast) var(--ease-out), box-shadow var(--t-fast) var(--ease-out)",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            } else if (e.key === "Escape") {
              setQuery("");
              inputRef.current?.blur();
            }
          }}
          placeholder={PLACEHOLDER}
          aria-label="ask the swarm a market question"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          maxLength={140}
          className="flex-1 bg-transparent outline-none px-4 py-3 sm:py-[14px]"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            letterSpacing: "0.02em",
            color: "var(--fg)",
            caretColor: "var(--cyan)",
          }}
        />
        <button
          type="button"
          onClick={submit}
          onMouseDown={(e) => e.preventDefault()}
          disabled={submitting}
          className="btn btn-sol"
          style={{
            borderRadius: 0,
            padding: "0 18px",
            minHeight: "100%",
            fontSize: 12,
            letterSpacing: "0.18em",
          }}
        >
          {submitting ? "…" : "ASK →"}
        </button>
      </div>

      {error && (
        <div
          className="t-label"
          style={{ color: "var(--magenta)" }}
          role="alert"
        >
          {error.replace(/_/g, " ")}. Try again?
        </div>
      )}
    </div>
  );
}
