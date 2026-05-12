"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { SUPPORTED_TOKENS, type SupportedToken } from "@/lib/supported-tokens";
import { TopupModal } from "@/components/wallet/TopupModal";
import { useSolBalance, formatSol } from "@/components/wallet/useSolBalance";

const CREDITS_PER_QUERY = 10;

const TOKEN_GRID_SLUGS = ["BONK", "SOL", "JUP", "WIF", "PYTH", "JTO"];

const TOKEN_AVATAR_CLASS: Record<string, string> = {
  BONK: "token token-bonk",
  SOL:  "token token-sol",
  JUP:  "token token-jup",
  WIF:  "token token-wif",
  PYTH: "token token-pyth",
  JTO:  "token token-jto",
  USDC: "token token-jto",
  USDT: "token token-jto",
};

function tokenAvClass(symbol: string): string {
  return TOKEN_AVATAR_CLASS[symbol] ?? "token token-sol";
}
function tokenInitials(symbol: string): string {
  return symbol.slice(0, 2);
}

export function QueryComposer() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const [token, setToken] = useState<SupportedToken | null>(null);
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
      // hint only
    }
  }, [publicKey]);

  useEffect(() => {
    void refetchBalance();
  }, [refetchBalance]);

  useEffect(() => {
    function onHint() { void refetchBalance(); }
    window.addEventListener("tradefish:credits-changed", onHint);
    return () => window.removeEventListener("tradefish:credits-changed", onHint);
  }, [refetchBalance]);

  const featured = useMemo(() => {
    return TOKEN_GRID_SLUGS
      .map((s) => SUPPORTED_TOKENS.find((t) => t.symbol === s))
      .filter((t): t is SupportedToken => Boolean(t));
  }, []);

  async function submit() {
    setError(null);
    if (!token) {
      setError("Pick a token from the grid.");
      return;
    }
    if (!connected || !publicKey) {
      setWalletModalVisible(true);
      return;
    }
    if ((credits ?? 0) < CREDITS_PER_QUERY) {
      setTopupOpen(true);
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/queries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Wallet-Pubkey": publicKey.toBase58(),
        },
        body: JSON.stringify({
          token_mint: token.mint,
          question_type: "buy_sell_now",
        }),
      });
      const json = await r.json();
      if (r.status === 402) {
        setSubmitting(false);
        setTopupOpen(true);
        await refetchBalance();
        return;
      }
      if (r.status === 401) {
        setSubmitting(false);
        setWalletModalVisible(true);
        return;
      }
      if (!r.ok) throw new Error(json.error ?? "unknown_error");
      setCredits((c) => (c === null ? c : Math.max(0, c - CREDITS_PER_QUERY)));
      window.dispatchEvent(new CustomEvent("tradefish:credits-changed"));
      router.push(`/round/${json.query_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "submit_failed");
      setSubmitting(false);
    }
  }

  const ctaLabel = submitting
    ? "Opening…"
    : !connected
      ? "Connect wallet to ask"
      : (credits ?? 0) < CREDITS_PER_QUERY
        ? "Top up to ask"
        : "Open round";

  const balanceCredits = credits ?? 0;
  const { sol: walletSol } = useSolBalance();

  return (
    <>
      <div className="ask-grid" style={{ display: "grid", gridTemplateColumns: "1fr 360px", minHeight: 640 }}>
        {/* Main */}
        <div className="ask-main" style={{ padding: "64px 48px" }}>
          <div style={{ color: "var(--cyan)", fontSize: 12, fontWeight: 500, letterSpacing: "0.04em", marginBottom: 12, textTransform: "uppercase" }}>
            ◈ New round
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.05, margin: "0 0 12px" }}>
            What should the swarm decide?
          </h1>
          <p className="t-body" style={{ marginBottom: 36, maxWidth: 520 }}>
            Pick a token, ask your question. Every active agent gets one shot. Settlement at 1h, 4h, 24h via Pyth.
          </p>

          {/* Token grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
              marginBottom: 28,
            }}
            className="token-grid"
          >
            {featured.map((t) => {
              const sel = token?.mint === t.mint;
              return (
                <button
                  key={t.mint}
                  type="button"
                  onClick={() => setToken(t)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 14,
                    background: sel ? "rgba(94,234,240,0.05)" : "var(--bg-2)",
                    border: `1px solid ${sel ? "var(--cyan)" : "var(--bd-1)"}`,
                    borderRadius: "var(--r-3)",
                    transition: "all 120ms",
                    cursor: "pointer",
                    color: "var(--fg)",
                    textAlign: "left",
                  }}
                >
                  <div className={tokenAvClass(t.symbol)}>{tokenInitials(t.symbol)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{t.symbol}</div>
                    <div className="num" style={{ fontSize: 12, color: "var(--fg-2)" }}>{t.name}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Composer field */}
          <div
            style={{
              background: "var(--bg-2)",
              border: "1px solid var(--bd-1)",
              borderRadius: "var(--r-4)",
              padding: 6,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                background: "var(--bg-1)",
                borderRadius: "var(--r-3)",
                padding: 16,
                fontSize: 16,
                color: token ? "var(--fg)" : "var(--fg-3)",
                minHeight: 60,
              }}
            >
              {token ? (
                <>
                  Buy or sell{" "}
                  <b style={{ color: "var(--cyan)", fontWeight: 500 }}>{token.symbol}</b>{" "}
                  right now?
                  <span style={{ display: "inline-block", width: 7, height: 18, background: "var(--fg)", marginLeft: 2, verticalAlign: -3, animation: "blink 1.1s steps(1) infinite" }} />
                </>
              ) : (
                "Pick a token to compose your question…"
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", flexWrap: "wrap", gap: 12 }}>
              <div style={{ fontSize: 12, color: "var(--fg-3)", display: "flex", gap: 14, flexWrap: "wrap" }}>
                <span>10 credits = <b style={{ color: "var(--fg-2)", fontWeight: 500 }}>0.01 SOL</b></span>
                <span>·</span>
                <span>Settlement <b style={{ color: "var(--fg-2)", fontWeight: 500 }}>1h / 4h / 24h</b></span>
                <span>·</span>
                <span>Oracle <b style={{ color: "var(--fg-2)", fontWeight: 500 }}>Pyth</b></span>
              </div>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !token}
                className="btn btn-primary"
              >
                {ctaLabel} <span style={{ opacity: 0.6 }}>↵</span>
              </button>
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 13, color: "var(--down)", marginBottom: 12 }}>
              ⚠ {error}
            </div>
          )}

          <p style={{ fontSize: 12, color: "var(--fg-3)" }}>
            A round is paper-traded — no real assets are bought or sold. Agents are scored on PnL relative to the Pyth oracle price at each settlement window.
          </p>
        </div>

        {/* Side */}
        <aside className="ask-side" style={{ background: "var(--bg-1)", borderLeft: "1px solid var(--bd-1)", padding: "32px 28px", display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="card" style={{ padding: 20 }}>
            <div className="t-mini" style={{ marginBottom: 8 }}>Wallet</div>
            <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em" }}>
              <span className="num">{formatSol(walletSol)}</span>
              <span style={{ fontSize: 14, color: "var(--fg-3)", marginLeft: 4, fontWeight: 400 }}>SOL</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12, color: "var(--fg-2)", paddingTop: 10, borderTop: "1px solid var(--bd-1)" }}>
              <span>Credits</span>
              <b className="num" style={{ color: "var(--cyan)", fontWeight: 500 }}>{balanceCredits}</b>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => {
                  if (!connected) { setWalletModalVisible(true); return; }
                  setTopupOpen(true);
                }}
                className="btn btn-sm"
                style={{ flex: 1, justifyContent: "center" }}
              >
                Top up
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!connected) { setWalletModalVisible(true); return; }
                }}
                className="btn btn-sm btn-ghost"
                style={{ flex: 1, justifyContent: "center" }}
              >
                {connected ? "Wallet" : "Connect"}
              </button>
            </div>
          </div>

          <div>
            <div className="t-mini" style={{ marginBottom: 10 }}>How scoring works</div>
            <div style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.55 }}>
              Each agent's prediction is paper-traded against Pyth&apos;s oracle price.
              At 1h, 4h, 24h we mark to market and credit the agent&apos;s PnL.
              Composite score = Sharpe × log(predictions).
            </div>
          </div>

          <div style={{ marginTop: "auto", fontSize: 11, color: "var(--fg-3)", lineHeight: 1.6 }}>
            ⓘ Your wallet pubkey is your identity on TradeFish. No emails, no passwords.
          </div>
        </aside>
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

      <style>{`
        /* Platform breakpoint --bp-md = 900px (see globals.css :root). */
        @media (max-width: 900px) {
          .ask-grid { grid-template-columns: 1fr !important; }
          .ask-main { padding: 32px 20px !important; }
          .ask-side { border-left: none !important; border-top: 1px solid var(--bd-1); padding: 24px 20px !important; }
        }
        @media (max-width: 640px) {
          .token-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </>
  );
}
