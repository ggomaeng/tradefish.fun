"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_TOKENS, type SupportedToken } from "@/lib/supported-tokens";

// Landing hero — locked-template asker.
// The backend currently only accepts { token_mint, question_type:
// "buy_sell_now" }, so the hero matches /ask's reality: the question
// is fixed as "Buy or sell $TOKEN right now?" and only the token is
// selectable (via a dropdown). When the backend grows free-form
// question support, swap this back to an input.

const TOKEN_SYMBOLS = ["SOL", "BONK", "JUP", "WIF", "PYTH", "JTO"] as const;
const DEFAULT_SYMBOL = "SOL";

const EV_ATTENTION_ON = "swarm:attention-on";
const EV_ATTENTION_OFF = "swarm:attention-off";
const EV_SUBMIT_BURST = "swarm:submit-burst";

const BURST_NAVIGATE_DELAY_MS = 580;

function findTokenBySymbol(symbol: string): SupportedToken | undefined {
  const u = symbol.trim().toUpperCase();
  return SUPPORTED_TOKENS.find((t) => t.symbol === u);
}

function dispatchSwarm(name: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name));
}

export function HeroAsk() {
  const router = useRouter();
  const [token, setToken] = useState<SupportedToken>(
    () => findTokenBySymbol(DEFAULT_SYMBOL) ?? SUPPORTED_TOKENS[0],
  );
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Click-outside closes the dropdown.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Escape closes the dropdown.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // The whole asker is "focused" while either the dropdown is open or
  // the user is hovering the row — drives the attention bloom + swarm
  // attention event.
  useEffect(() => {
    dispatchSwarm(focused || open ? EV_ATTENTION_ON : EV_ATTENTION_OFF);
  }, [focused, open]);

  const pick = (sym: string): void => {
    const t = findTokenBySymbol(sym);
    if (!t) return;
    setToken(t);
    setOpen(false);
    setError(null);
  };

  const submit = async (): Promise<void> => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    dispatchSwarm(EV_SUBMIT_BURST);
    try {
      const fetchP = fetch("/api/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token_mint: token.mint,
          question_type: "buy_sell_now",
        }),
      });
      const minWait = new Promise<void>((r) =>
        setTimeout(r, BURST_NAVIGATE_DELAY_MS),
      );
      const [r] = await Promise.all([fetchP, minWait]);

      // Wallet / credit gates → graceful ferry to /ask with the same
      // token pre-selected (QueryComposer reads ?symbol=). The hero is
      // a marketing surface that shouldn't dead-end when the paywall is
      // on; /ask carries the full wallet-connect + topup UI.
      if (r.status === 401 || r.status === 402) {
        router.push(`/ask?symbol=${token.symbol}`);
        return;
      }

      const json = (await r.json()) as { query_id?: string; error?: string };
      if (!r.ok) throw new Error(json.error ?? "submit_failed");
      router.push(`/round/${json.query_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "submit_failed");
      setSubmitting(false);
    }
  };

  const active = focused || open;

  return (
    <div
      className="w-full max-w-[640px] flex flex-col items-center gap-4 tf-fade-up"
      style={{ animationDelay: "120ms" }}
    >
      <div className="relative w-full">
        {/* Bloom behind the row — fades in on focus / dropdown open. */}
        <div
          className="tf-attention-bloom"
          aria-hidden
          data-attention={active ? "true" : "false"}
        />

        <div
          ref={wrapRef}
          data-swarm-anchor
          onMouseEnter={() => setFocused(true)}
          onMouseLeave={() => setFocused(false)}
          className="relative w-full flex items-stretch transition-colors"
          style={{
            background: "rgba(13,24,48,0.78)",
            border: `1px solid ${active ? "var(--cyan)" : "var(--line-strong)"}`,
            backdropFilter: "blur(10px)",
            boxShadow: active
              ? "0 0 0 3px rgba(168,216,232,0.14), 0 24px 60px -20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)"
              : "0 0 0 1px rgba(168,216,232,0.06), 0 24px 60px -20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
            transition:
              "border-color var(--t-fast) var(--ease-out), box-shadow var(--t-fast) var(--ease-out)",
          }}
        >
          {/* Question template — "Buy or sell [TOKEN ▼] right now?" */}
          <div
            className="flex-1 flex items-center flex-wrap gap-x-2 px-5 py-4 sm:py-[18px] text-[14px] sm:text-[16px] tracking-[0.04em]"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--cream)",
            }}
          >
            <span>Buy or sell</span>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-label={`Token: ${token.symbol}`}
              className="inline-flex items-center gap-2 px-2.5 py-1 transition-colors"
              style={{
                background: open
                  ? "rgba(168,216,232,0.12)"
                  : "rgba(168,216,232,0.05)",
                border: "1px solid var(--cyan-bd)",
                color: "var(--cyan-bright)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.06em",
              }}
            >
              <span>${token.symbol}</span>
              <span
                aria-hidden
                style={{
                  fontFamily: "var(--font-pixel)",
                  fontSize: 11,
                  opacity: 0.7,
                  transform: open ? "rotate(180deg)" : "none",
                  transition: "transform var(--t-fast) var(--ease-out)",
                  display: "inline-block",
                }}
              >
                ▾
              </span>
            </button>
            <span>right now?</span>
          </div>

          <button
            type="button"
            onClick={submit}
            onMouseDown={(e) => e.preventDefault()}
            disabled={submitting}
            aria-label="ask the swarm"
            title="Ask the swarm"
            className="inline-flex items-center justify-center w-12 h-auto self-stretch transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "var(--cyan)",
              color: "var(--bg-0)",
              borderRadius: 0,
              boxShadow:
                "0 0 24px rgba(168,216,232,0.32), inset 0 0 0 1px rgba(255,255,255,0.18)",
            }}
          >
            <span
              style={{ fontFamily: "var(--font-pixel)", fontSize: 18 }}
              aria-hidden
            >
              {submitting ? "…" : "▸"}
            </span>
          </button>

          {/* Dropdown — absolute positioned, opens below the row */}
          {open && (
            <div
              role="listbox"
              aria-label="Select a token"
              className="absolute left-0 right-12 top-[calc(100%+6px)] z-10"
              style={{
                background: "rgba(13,24,48,0.92)",
                border: "1px solid var(--cyan-bd)",
                backdropFilter: "blur(10px)",
                boxShadow:
                  "0 0 0 3px rgba(168,216,232,0.10), 0 24px 60px -20px rgba(0,0,0,0.6)",
              }}
            >
              {TOKEN_SYMBOLS.map((sym) => {
                const t = findTokenBySymbol(sym);
                if (!t) return null;
                const selected = t.mint === token.mint;
                return (
                  <button
                    key={sym}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => pick(sym)}
                    className="w-full flex items-center justify-between px-5 py-2.5 transition-colors text-left"
                    style={{
                      background: selected
                        ? "rgba(168,216,232,0.10)"
                        : "transparent",
                      color: selected ? "var(--cyan-bright)" : "var(--cream)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      letterSpacing: "0.06em",
                      borderTop: "1px solid rgba(168,216,232,0.08)",
                    }}
                    onMouseEnter={(e) => {
                      if (!selected)
                        e.currentTarget.style.background =
                          "rgba(168,216,232,0.06)";
                    }}
                    onMouseLeave={(e) => {
                      if (!selected)
                        e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span>
                      <span style={{ color: "var(--cyan-bright)" }}>$</span>
                      {sym}
                      <span
                        style={{
                          color: "var(--fg-faint)",
                          marginLeft: 10,
                          fontSize: 11,
                          letterSpacing: "0.14em",
                        }}
                      >
                        {t.name.toUpperCase()}
                      </span>
                    </span>
                    {selected && (
                      <span
                        aria-hidden
                        style={{
                          fontFamily: "var(--font-pixel)",
                          color: "var(--cyan-bright)",
                          fontSize: 11,
                        }}
                      >
                        ●
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div
          className="text-[11px] tracking-[0.18em] uppercase"
          style={{ color: "var(--short)", fontFamily: "var(--font-mono)" }}
        >
          ⚠ {error.replace(/_/g, " ")}
        </div>
      )}

      <Link
        href="/agents/register"
        className="group/cta mt-3 inline-flex items-center gap-2 text-[11px] sm:text-[12px] tracking-[0.24em] uppercase transition-colors"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--fg-dim)",
        }}
      >
        <span style={{ color: "var(--magenta)" }} aria-hidden>
          ◇
        </span>
        <span className="group-hover/cta:text-[var(--cream)]">
          BUILDER? PLUG IN YOUR TRADING AGENT
        </span>
        <span
          aria-hidden
          className="transition-transform duration-150 group-hover/cta:translate-x-[3px]"
        >
          →
        </span>
      </Link>
    </div>
  );
}
