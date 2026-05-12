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

const ASK_ABOUT_SYMBOLS = ["SOL", "JUP", "BONK", "WIF"] as const;
const DEFAULT_SYMBOL = "SOL";

const EV_ATTENTION_ON = "swarm:attention-on";
const EV_ATTENTION_OFF = "swarm:attention-off";
const EV_SUBMIT_BURST = "swarm:submit-burst";

const BURST_NAVIGATE_DELAY_MS = 580;

// Rotating placeholder prompts. Mix of short punchy + longer trader-
// brain questions so the cycle reads as a live newsroom of decisions
// rather than a single canned example.
const PLACEHOLDERS = [
  "will $SOL break $200 in 4h?",
  "should i long $JUP for 24h?",
  "scalp $BONK in the next 1h?",
  "$WIF: capitulation or bear trap?",
  "swarm, where's $SOL going in 4h?",
  "fade the $JUP rally?",
  "$BONK setting up a breakout?",
  "short $SOL into the close?",
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
  const [token, setToken] = useState<SupportedToken>(
    () => findTokenBySymbol(DEFAULT_SYMBOL) ?? SUPPORTED_TOKENS[0],
  );
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Pause the typewriter when the user has the input engaged so the
  // placeholder doesn't advance invisibly behind a typed value.
  const placeholderActive = query === "" && !focused;
  const { text: phText, caret: phCaret } = useTypewriter(
    PLACEHOLDERS,
    placeholderActive,
  );

  const onInputFocus = (): void => {
    setFocused(true);
    dispatchSwarm(EV_ATTENTION_ON);
  };

  const onInputBlur = (): void => {
    setFocused(false);
    dispatchSwarm(EV_ATTENTION_OFF);
  };

  /**
   * Clicking a chip drops a starter question into the input and
   * focuses it. Gives the user a sentence to edit instead of a blank
   * field; also primes the swarm attention orbit.
   */
  const pickStarter = (symbol: string): void => {
    const t = findTokenBySymbol(symbol);
    if (!t) return;
    setToken(t);
    setQuery(`should i long $${symbol} in 4h?`);
    inputRef.current?.focus();
  };

  const submit = async (): Promise<void> => {
    if (submitting) return;
    const parsed = extractToken(query);
    const t = parsed ?? token;
    if (!t) return;
    setError(null);
    setSubmitting(true);
    dispatchSwarm(EV_SUBMIT_BURST);
    try {
      const fetchP = fetch("/api/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token_mint: t.mint,
          question_type: "buy_sell_now",
        }),
      });
      const minWait = new Promise<void>((r) =>
        setTimeout(r, BURST_NAVIGATE_DELAY_MS),
      );
      const [r] = await Promise.all([fetchP, minWait]);
      const json = (await r.json()) as { query_id?: string; error?: string };
      if (!r.ok) throw new Error(json.error ?? "submit_failed");
      router.push(`/round/${json.query_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "submit_failed");
      setSubmitting(false);
    }
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
          className="relative w-full flex items-stretch transition-colors"
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
          {/* Input + typewriter overlay. The overlay is rendered as an
              absolutely-positioned span over the input only when the
              field is empty AND unfocused — so the native caret takes
              over the moment the user clicks in. */}
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={onInputFocus}
              onBlur={onInputBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                } else if (e.key === "Escape") {
                  setQuery("");
                  inputRef.current?.blur();
                }
              }}
              aria-label="ask the swarm a market question"
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              maxLength={140}
              className="w-full bg-transparent outline-none text-[14px] sm:text-[16px] tracking-[0.04em] px-5 py-4 sm:py-[18px]"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--cream)",
                caretColor: "var(--cyan-bright)",
              }}
            />
            {query === "" && !focused && (
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

          <button
            type="button"
            onClick={submit}
            // Prevent the input's blur from firing before the click —
            // keeps the swarm's attention/orbit alive into the burst.
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
