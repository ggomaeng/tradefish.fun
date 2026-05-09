"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SUPPORTED_TOKENS, type SupportedToken } from "@/lib/supported-tokens";

const ACTIONS = [{ value: "buy_sell", label: "buy or sell" }] as const;

export function QueryComposer() {
  const router = useRouter();
  const [token, setToken] = useState<SupportedToken | null>(null);
  const [action] = useState<typeof ACTIONS[number]["value"]>("buy_sell");
  const [tokenQuery, setTokenQuery] = useState("");
  const [tokenOpen, setTokenOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = tokenQuery.trim().toLowerCase();
    if (!q) return SUPPORTED_TOKENS.slice(0, 8);
    return SUPPORTED_TOKENS
      .filter((t) => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [tokenQuery]);

  async function submit() {
    setError(null);
    if (!token) {
      setError("Pick a token from the list.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token_mint: token.mint,
          question_type: "buy_sell_now",
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "unknown_error");
      router.push(`/round/${json.query_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "submit_failed");
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <div className="text-xs uppercase tracking-wide text-muted mb-3">Ask the swarm</div>

      <div className="flex flex-wrap items-center gap-2 text-lg sm:text-xl font-medium">
        <span className="text-muted">Should I</span>

        <select
          value={action}
          disabled
          className="bg-panel-2 border border-border rounded-md px-3 py-1.5 text-base"
          aria-label="action"
        >
          {ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>

        <div className="relative">
          <button
            type="button"
            onClick={() => setTokenOpen((v) => !v)}
            className="bg-panel-2 border border-border rounded-md px-3 py-1.5 text-base flex items-center gap-2 min-w-[140px] justify-between"
          >
            {token ? (
              <span className="font-mono text-accent">{token.symbol}</span>
            ) : (
              <span className="text-muted">pick a token</span>
            )}
            <span className="text-muted text-xs">⌄</span>
          </button>

          {tokenOpen && (
            <div className="absolute mt-2 w-72 bg-panel-2 border border-border rounded-lg shadow-lg z-20 p-2">
              <input
                autoFocus
                value={tokenQuery}
                onChange={(e) => setTokenQuery(e.target.value)}
                placeholder="search SOL, JUP, BONK…"
                className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm font-mono outline-none focus:border-accent"
              />
              <ul className="mt-2 max-h-64 overflow-auto">
                {matches.length === 0 && (
                  <li className="text-sm text-muted px-2 py-2">No supported tokens match.</li>
                )}
                {matches.map((t) => (
                  <li key={t.mint}>
                    <button
                      type="button"
                      className="w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-panel"
                      onClick={() => {
                        setToken(t);
                        setTokenOpen(false);
                        setTokenQuery("");
                      }}
                    >
                      <span className="font-mono text-accent">{t.symbol}</span>
                      <span className="text-xs text-muted truncate">{t.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <span className="text-muted">now?</span>
      </div>

      {error && <div className="mt-3 text-sm text-bad font-mono">⚠ {error}</div>}

      <div className="mt-5 flex items-center justify-between">
        <span className="text-xs text-muted font-mono">cost: 10 credits</span>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !token}
          className="bg-accent text-background px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {submitting ? "Asking…" : "Ask the swarm →"}
        </button>
      </div>
    </div>
  );
}
