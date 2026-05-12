"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SUPPORTED_TOKENS, type SupportedToken } from "@/lib/supported-tokens";

// Landing input — single free-form text field with a rotating
// typewriter placeholder. Backend contract is unchanged: on submit we
// soft-parse the typed text for a token symbol (e.g., "$SOL" or "SOL")
// and POST { token_mint, question_type: "buy_sell_now" } per AGENTS.md.
// The question text itself is currently discarded — future backend
// extension can accept the raw prompt.

// All six supported tokens — matches /ask's grid so the hero is honest
// about what the platform actually accepts.
const ASK_ABOUT_SYMBOLS = ["SOL", "BONK", "JUP", "WIF", "PYTH", "JTO"] as const;
const DEFAULT_SYMBOL = "SOL";

const EV_ATTENTION_ON = "swarm:attention-on";
const EV_ATTENTION_OFF = "swarm:attention-off";
const EV_SUBMIT_BURST = "swarm:submit-burst";

const BURST_NAVIGATE_DELAY_MS = 580;

// Rotating placeholder — canonical "Buy or sell $TOKEN right now?" form
// only, cycling through the 6 supported tokens. The backend accepts
// { token_mint, question_type: "buy_sell_now" } and discards everything
// else, so the placeholder shouldn't promise free-form Q&A.
const PLACEHOLDERS = [
  "Buy or sell $SOL right now?",
  "Buy or sell $BONK right now?",
  "Buy or sell $JUP right now?",
  "Buy or sell $WIF right now?",
  "Buy or sell $PYTH right now?",
  "Buy or sell $JTO right now?",
] as const;

// Typewriter tunables. Per-character variance gives a human typing
// feel; ALL keys are deterministic-ish so the effect doesn't flicker.
const TYPE_BASE_MS = 38;
const TYPE_JITTER_MS = 28;
const DELETE_MS = 22;
const HOLD_MS = 1800;
const POST_DELETE_PAUSE_MS = 350;

function findTokenBySymbol(symbol: string): SupportedToken | undefined {
  const u = symbol.trim().toUpperCase();
  return SUPPORTED_TOKENS.find((t) => t.symbol === u);
}

/**
 * Extract the first supported token referenced in `text`. Prefers the
 * `$SYMBOL` form (e.g. `$SOL`), falling back to bare uppercase symbol
 * matches at word boundaries. Returns null if no supported token is
 * mentioned.
 */
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

function dispatchSwarm(name: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name));
}

type Phase = "typing" | "holding" | "deleting";

/**
 * Self-driving typewriter that cycles a list of strings: types →
 * holds → deletes → next. `active` gates the scheduler so the cycle
 * pauses when the input has focus or content (otherwise the
 * placeholder would advance silently behind the user).
 */
function useTypewriter(
  strings: readonly string[],
  active: boolean,
): { text: string; caret: boolean } {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("typing");

  useEffect(() => {
    if (!active) return;
    const cur = strings[idx] ?? "";
    if (phase === "typing") {
      if (text.length < cur.length) {
        const delay = TYPE_BASE_MS + Math.random() * TYPE_JITTER_MS;
        const t = setTimeout(
          () => setText(cur.slice(0, text.length + 1)),
          delay,
        );
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase("holding"), 60);
      return () => clearTimeout(t);
    }
    if (phase === "holding") {
      const t = setTimeout(() => setPhase("deleting"), HOLD_MS);
      return () => clearTimeout(t);
    }
    // phase === "deleting"
    if (text.length > 0) {
      const t = setTimeout(() => setText(text.slice(0, -1)), DELETE_MS);
      return () => clearTimeout(t);
    }
    // Done deleting — short pause, then advance to the next string.
    const t = setTimeout(() => {
      setIdx((i) => (i + 1) % strings.length);
      setPhase("typing");
    }, POST_DELETE_PAUSE_MS);
    return () => clearTimeout(t);
  }, [text, phase, idx, strings, active]);

  return { text, caret: true };
}

export function HeroAsk() {
  const router = useRouter();
  const query = "";
  const focused = false;
  const inputRef = useRef<HTMLInputElement | null>(null);

  // The landing input is a doorway, not a form — typewriter always runs.
  const { text: phText, caret: phCaret } = useTypewriter(PLACEHOLDERS, true);

  const pickStarter = (symbol: string): void => {
    const t = findTokenBySymbol(symbol);
    if (!t) return;
    dispatchSwarm(EV_SUBMIT_BURST);
    router.push(`/ask?symbol=${encodeURIComponent(symbol)}`);
  };

  const goToAsk = (): void => {
    dispatchSwarm(EV_SUBMIT_BURST);
    router.push("/ask");
  };

  return (
    <div
      className="w-full max-w-[640px] flex flex-col items-center gap-4 tf-fade-up"
      style={{ animationDelay: "120ms" }}
    >
      <div className="relative w-full">
        {/* Bloom behind the input — fades in on focus. */}
        <div
          className="tf-attention-bloom"
          aria-hidden
          data-attention={focused ? "true" : "false"}
        />

        <div
          data-swarm-anchor
          onClick={goToAsk}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              goToAsk();
            }
          }}
          className="relative w-full flex items-stretch transition-colors cursor-pointer"
          style={{
            background: "rgba(13,24,48,0.78)",
            border: `1px solid ${focused ? "var(--cyan)" : "var(--line-strong)"}`,
            backdropFilter: "blur(10px)",
            boxShadow: focused
              ? "0 0 0 3px rgba(168,216,232,0.14), 0 24px 60px -20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)"
              : "0 0 0 1px rgba(168,216,232,0.06), 0 24px 60px -20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
            transition:
              "border-color var(--t-fast) var(--ease-out), box-shadow var(--t-fast) var(--ease-out)",
          }}
        >
          {/* Input acts as a doorway to /ask — readOnly + pointer cursor,
              click anywhere on the row navigates. Typewriter overlay still
              renders behind the empty field. */}
          <div className="relative flex-1 pointer-events-none">
            <input
              ref={inputRef}
              type="text"
              value={query}
              readOnly
              tabIndex={-1}
              aria-hidden
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              className="w-full bg-transparent outline-none text-[14px] sm:text-[16px] tracking-[0.04em] px-5 py-4 sm:py-[18px] cursor-pointer"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--cream)",
                caretColor: "transparent",
              }}
            />
            {query === "" && (
              <span
                aria-hidden
                className="absolute inset-0 pointer-events-none flex items-center px-5 text-[14px] sm:text-[16px] tracking-[0.04em] whitespace-nowrap overflow-hidden"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--fg-faint)",
                }}
              >
                <span>{phText}</span>
                {phCaret && (
                  <span
                    className="tf-caret-blink ml-[1px] inline-block"
                    style={{
                      width: "0.5ch",
                      height: "1.1em",
                      background: "var(--cyan-bright)",
                      opacity: 0.65,
                    }}
                  />
                )}
              </span>
            )}
          </div>

          <div
            aria-hidden
            className="inline-flex items-center justify-center w-12 h-auto self-stretch transition-all pointer-events-none"
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
              ▸
            </span>
          </div>
        </div>
      </div>

      <div
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] tracking-[0.22em] uppercase"
        style={{ fontFamily: "var(--font-mono)", color: "var(--fg-faint)" }}
      >
        <span>ASK ABOUT</span>
        <span aria-hidden style={{ color: "var(--fg-faintest)" }}>
          •
        </span>
        {ASK_ABOUT_SYMBOLS.map((sym) => (
          <button
            key={sym}
            type="button"
            onClick={() => pickStarter(sym)}
            className="transition-colors hover:text-[var(--cyan-bright)]"
          >
            ${sym}
          </button>
        ))}
      </div>

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
