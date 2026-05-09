"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { SUPPORTED_TOKENS, type SupportedToken } from "@/lib/supported-tokens";
import { TopupModal } from "@/components/wallet/TopupModal";

const ACTIONS = [{ value: "buy_sell", label: "buy or sell" }] as const;
const CREDITS_PER_QUERY = 10;

export function QueryComposer() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const [token, setToken] = useState<SupportedToken | null>(null);
  const [action] = useState<typeof ACTIONS[number]["value"]>("buy_sell");
  const [tokenQuery, setTokenQuery] = useState("");
  const [tokenOpen, setTokenOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [topupOpen, setTopupOpen] = useState(false);

  const refetchBalance = useCallback(async () => {
    if (!publicKey) {
      setCredits(null);
      return;
    }
    try {
      const r = await fetch(
        `/api/credits/balance?wallet=${publicKey.toBase58()}`,
        { cache: "no-store" },
      );
      if (!r.ok) return;
      const json = (await r.json()) as { credits?: number };
      setCredits(typeof json.credits === "number" ? json.credits : 0);
    } catch {
      // composer balance is a hint; don't crash on transient errors
    }
  }, [publicKey]);

  useEffect(() => {
    void refetchBalance();
  }, [refetchBalance]);

  // Listen for cross-component balance hints (e.g. nav widget topup).
  useEffect(() => {
    function onHint() {
      void refetchBalance();
    }
    window.addEventListener("tradefish:credits-changed", onHint);
    return () =>
      window.removeEventListener("tradefish:credits-changed", onHint);
  }, [refetchBalance]);

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
    // If a wallet is connected but underfunded, route to topup instead of
    // sending an obviously-doomed request.
    if (connected && publicKey && (credits ?? 0) < CREDITS_PER_QUERY) {
      setTopupOpen(true);
      return;
    }
    setSubmitting(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (connected && publicKey) {
        headers["X-Wallet-Pubkey"] = publicKey.toBase58();
      }
      const r = await fetch("/api/queries", {
        method: "POST",
        headers,
        body: JSON.stringify({
          token_mint: token.mint,
          question_type: "buy_sell_now",
        }),
      });
      const json = await r.json();
      if (r.status === 402) {
        // Server says we don't have enough — open topup modal instead of error.
        setSubmitting(false);
        setTopupOpen(true);
        await refetchBalance();
        return;
      }
      if (!r.ok) throw new Error(json.error ?? "unknown_error");
      // Optimistically update local balance and notify nav widget.
      if (connected && publicKey) {
        setCredits((c) => (c === null ? c : Math.max(0, c - CREDITS_PER_QUERY)));
        window.dispatchEvent(new CustomEvent("tradefish:credits-changed"));
      }
      router.push(`/round/${json.query_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "submit_failed");
      setSubmitting(false);
    }
  }

  return (
    <>
    <div className="tf-term">
      <div className="tf-term-head">
        <div className="flex items-center gap-3">
          <div className="dots">
            <span />
            <span />
            <span />
          </div>
          <span>QUERY · COMPOSER</span>
        </div>
        <span style={{ color: "var(--cyan)" }}>
          {connected && credits !== null
            ? `BALANCE ${credits} CR · COST 10`
            : "10 CREDITS"}
        </span>
      </div>

      <div className="p-5">
        <div className="t-label" style={{ color: "var(--cyan)" }}>
          ▸ ASK
        </div>

        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: "var(--t-h2)",
            letterSpacing: "0.02em",
            color: "var(--fg)",
          }}
        >
          <span style={{ color: "var(--fg-faint)" }}>SHOULD I</span>

          <select
            value={action}
            disabled
            aria-label="action"
            style={{
              background: "var(--bg-2)",
              border: "1px solid var(--line-strong)",
              borderRadius: "var(--r-0)",
              padding: "6px 12px",
              fontFamily: "var(--font-pixel)",
              fontSize: "var(--t-h2)",
              color: "var(--fg)",
              outline: "none",
            }}
          >
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label.toUpperCase()}
              </option>
            ))}
          </select>

          <div className="relative">
            <button
              type="button"
              onClick={() => setTokenOpen((v) => !v)}
              style={{
                background: "var(--bg-2)",
                border: "1px solid var(--line-strong)",
                borderRadius: "var(--r-0)",
                padding: "6px 12px",
                fontFamily: "var(--font-pixel)",
                fontSize: "var(--t-h2)",
                color: token ? "var(--cyan)" : "var(--fg-faint)",
                cursor: "pointer",
                minWidth: 160,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span>{token ? `$${token.symbol}` : "PICK A TOKEN"}</span>
              <span style={{ color: "var(--fg-faint)", fontSize: "var(--t-small)" }}>▾</span>
            </button>

            {tokenOpen && (
              <div
                className="absolute mt-2 z-20"
                style={{
                  width: 288,
                  background: "var(--surface-deep)",
                  border: "1px solid var(--line-strong)",
                  borderRadius: "var(--r-0)",
                  padding: 8,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                }}
              >
                <input
                  autoFocus
                  value={tokenQuery}
                  onChange={(e) => setTokenQuery(e.target.value)}
                  placeholder="search SOL, JUP, BONK…"
                  style={{
                    width: "100%",
                    background: "var(--bg-1)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--r-0)",
                    padding: "6px 10px",
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--t-small)",
                    color: "var(--fg)",
                    outline: "none",
                  }}
                />
                <ul className="mt-2 max-h-64 overflow-auto" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {matches.length === 0 && (
                    <li
                      className="px-2 py-2"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--t-small)",
                        color: "var(--fg-faint)",
                      }}
                    >
                      No supported tokens match.
                    </li>
                  )}
                  {matches.map((t) => (
                    <li key={t.mint}>
                      <button
                        type="button"
                        className="w-full text-left flex items-center justify-between gap-2"
                        onClick={() => {
                          setToken(t);
                          setTokenOpen(false);
                          setTokenQuery("");
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          padding: "8px 10px",
                          cursor: "pointer",
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--t-small)",
                          color: "var(--fg-dim)",
                          transition: "background var(--t-fast)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-glass)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <span style={{ color: "var(--cyan)" }}>${t.symbol}</span>
                        <span
                          className="truncate"
                          style={{ fontSize: "var(--t-mini)", color: "var(--fg-faint)" }}
                        >
                          {t.name}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <span style={{ color: "var(--fg-faint)" }}>NOW?</span>
        </div>

        {error && (
          <div
            className="mt-4"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--t-small)",
              color: "var(--short)",
              letterSpacing: "0.04em",
            }}
          >
            ⚠ {error}
          </div>
        )}

        <div className="tf-hr mt-5" />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--t-mini)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--fg-faint)",
            }}
          >
            COST <span style={{ color: "var(--fg)" }}>10 CREDITS</span> · SETTLES{" "}
            <span style={{ color: "var(--fg)" }}>1H · 4H · 24H</span>
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !token}
            className="tf-cta"
            style={{
              opacity: submitting || !token ? 0.4 : 1,
              cursor: submitting || !token ? "not-allowed" : "pointer",
            }}
          >
            {submitting
              ? "ASKING…"
              : connected && (credits ?? 0) < CREDITS_PER_QUERY
                ? "TOP UP TO ASK"
                : "OPEN ROUND"}{" "}
            <span style={{ opacity: 0.6 }}>→</span>
          </button>
        </div>
      </div>
    </div>
    <TopupModal
      open={topupOpen}
      onClose={() => {
        setTopupOpen(false);
        void refetchBalance();
      }}
      onSuccess={(c) => {
        setCredits(c);
        window.dispatchEvent(new CustomEvent("tradefish:credits-changed"));
      }}
    />
    </>
  );
}
