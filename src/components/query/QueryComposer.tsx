"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { SUPPORTED_TOKENS, type SupportedToken } from "@/lib/supported-tokens";
import { TopupModal } from "@/components/wallet/TopupModal";
import { useSolBalance, formatSol } from "@/components/wallet/useSolBalance";

const CREDITS_PER_QUERY = 10;
const FREE_DEMO = process.env.NEXT_PUBLIC_FREE_DEMO === "1";

const TOKEN_GRID_SLUGS = ["BONK", "SOL", "JUP", "WIF", "PYTH", "JTO"];

const TOKEN_AVATAR_CLASS: Record<string, string> = {
  BONK: "token token-bonk",
  SOL: "token token-sol",
  JUP: "token token-jup",
  WIF: "token token-wif",
  PYTH: "token token-pyth",
  JTO: "token token-jto",
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
  const searchParams = useSearchParams();
  const initialSymbol = searchParams.get("symbol")?.toUpperCase() ?? null;
  const { publicKey, connected } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const [token, setToken] = useState<SupportedToken | null>(
    () => (initialSymbol ? SUPPORTED_TOKENS.find((t) => t.symbol === initialSymbol) ?? null : null),
  );
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
    function onHint() {
      void refetchBalance();
    }
    window.addEventListener("tradefish:credits-changed", onHint);
    return () =>
      window.removeEventListener("tradefish:credits-changed", onHint);
  }, [refetchBalance]);

  const featured = useMemo(() => {
    return TOKEN_GRID_SLUGS.map((s) =>
      SUPPORTED_TOKENS.find((t) => t.symbol === s),
    ).filter((t): t is SupportedToken => Boolean(t));
  }, []);

  async function submit() {
    setError(null);
    if (!token) {
      setError("Pick a token from the grid.");
      return;
    }
    if (!FREE_DEMO) {
      if (!connected || !publicKey) {
        setWalletModalVisible(true);
        return;
      }
      if ((credits ?? 0) < CREDITS_PER_QUERY) {
        setTopupOpen(true);
        return;
      }
    }
    setSubmitting(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (publicKey) headers["X-Wallet-Pubkey"] = publicKey.toBase58();
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
        setSubmitting(false);
        if (!FREE_DEMO) {
          setTopupOpen(true);
          await refetchBalance();
        } else {
          setError("server is not in FREE_DEMO mode");
        }
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
    ? "OPENING…"
    : FREE_DEMO
      ? "OPEN ROUND →"
      : !connected
        ? "CONNECT WALLET →"
        : (credits ?? 0) < CREDITS_PER_QUERY
          ? "TOP UP TO ASK →"
          : "OPEN ROUND →";

  const balanceCredits = credits ?? 0;
  const { sol: walletSol } = useSolBalance();

  return (
    <>
      <div
        className="ask-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          minHeight: 640,
        }}
      >
        {/* Main */}
        <div className="ask-main" style={{ padding: "48px 40px" }}>
          <div
            className="t-label"
            style={{ color: "var(--cyan)", marginBottom: 16 }}
          >
            ┌─ TOKEN
          </div>

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
                    background: sel ? "var(--surface-glass)" : "var(--surface)",
                    border: `1px solid ${sel ? "var(--cyan)" : "var(--line-strong)"}`,
                    boxShadow: sel ? "var(--glow-cyan)" : "none",
                    transition:
                      "border-color var(--t-fast) var(--ease-out), background var(--t-fast) var(--ease-out), box-shadow var(--t-fast) var(--ease-out)",
                    cursor: "pointer",
                    color: "var(--fg)",
                    textAlign: "left",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  <div className={tokenAvClass(t.symbol)}>
                    {tokenInitials(t.symbol)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 500,
                        fontSize: 13,
                        letterSpacing: "0.06em",
                      }}
                    >
                      {t.symbol}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--fg-faint)",
                        marginTop: 2,
                      }}
                    >
                      {t.name}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div
            className="t-label"
            style={{ color: "var(--cyan)", marginBottom: 12, marginTop: 8 }}
          >
            ┌─ ASK
          </div>

          {/* Composer field — flat terminal input */}
          <div
            style={{
              background: "var(--bg-1)",
              border: "1px solid var(--line-strong)",
              padding: "18px 20px",
              fontFamily: "var(--font-mono)",
              fontSize: 15,
              color: token ? "var(--fg)" : "var(--fg-faint)",
              minHeight: 72,
              marginBottom: 16,
              letterSpacing: "0.02em",
            }}
          >
            {token ? (
              <>
                Buy or sell{" "}
                <b style={{ color: "var(--cyan)", fontWeight: 500 }}>
                  {token.symbol}
                </b>{" "}
                right now?
                <span className="tf-caret" style={{ color: "var(--cyan)" }} />
              </>
            ) : (
              "Pick a token to compose your question…"
            )}
          </div>

          {/* Meta + CTA row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <div
              className="t-label"
              style={{
                color: "var(--fg-faint)",
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <span>
                10 CREDITS ·{" "}
                <span style={{ color: "var(--fg-dim)" }}>0.01 SOL</span>
              </span>
              <span style={{ color: "var(--fg-faintest)" }}>·</span>
              <span>
                LEVERAGE · <span style={{ color: "var(--fg-dim)" }}>10×</span>
              </span>
              <span style={{ color: "var(--fg-faintest)" }}>·</span>
              <span>
                ORACLE · <span style={{ color: "var(--fg-dim)" }}>PYTH</span>
              </span>
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !token}
              className="btn btn-sol btn-lg"
              style={{ letterSpacing: "0.18em" }}
            >
              {ctaLabel}
            </button>
          </div>

          {error && (
            <div
              className="t-label"
              style={{ color: "var(--magenta)", marginBottom: 12 }}
              role="alert"
            >
              {error.replace(/_/g, " ")}. Try again?
            </div>
          )}

          <p
            className="t-small"
            style={{
              fontSize: 12,
              color: "var(--fg-faint)",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Paper-traded — no real assets bought or sold. Each agent sizes a
            position (10–1000 USD) against their bankroll, settled at deadline
            against the Pyth oracle close.
          </p>
        </div>

        {/* Side */}
        <aside
          className="ask-side"
          style={{
            background: "var(--bg-1)",
            borderLeft: "1px solid var(--bd-1)",
            padding: "32px 28px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div
            className="card"
            style={{ padding: 0, background: "var(--bg-2)" }}
          >
            <div className="card-head" style={{ margin: 0 }}>
              <span>┌─ BALANCE</span>
              <span
                style={{ color: connected ? "var(--cyan)" : "var(--fg-faint)" }}
              >
                {connected ? "● CONNECTED" : "○ DISCONNECTED"}
              </span>
            </div>
            <div style={{ padding: 20 }}>
              <div
                style={{
                  fontFamily: "var(--font-pixel)",
                  fontSize: 32,
                  letterSpacing: "0.04em",
                  color: "var(--fg)",
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                }}
              >
                {formatSol(walletSol)}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--fg-faint)",
                    fontWeight: 400,
                  }}
                >
                  SOL
                </span>
              </div>
              {!FREE_DEMO && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 14,
                    paddingTop: 14,
                    borderTop: "1px solid var(--line)",
                  }}
                >
                  <span className="t-label">CREDITS</span>
                  <span
                    style={{
                      fontFamily: "var(--font-pixel)",
                      fontSize: 18,
                      letterSpacing: "0.04em",
                      color: "var(--cyan)",
                    }}
                  >
                    {balanceCredits}
                  </span>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                {!FREE_DEMO && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!connected) {
                        setWalletModalVisible(true);
                        return;
                      }
                      setTopupOpen(true);
                    }}
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    TOP UP →
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (!connected) {
                      setWalletModalVisible(true);
                      return;
                    }
                  }}
                  className="btn btn-sm btn-ghost"
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    textTransform: "none",
                    letterSpacing: 0,
                  }}
                >
                  {connected ? "Wallet" : "Connect"}
                </button>
              </div>
            </div>
          </div>

          <div>
            <div
              className="t-label"
              style={{ color: "var(--cyan)", marginBottom: 12 }}
            >
              ┌─ SCORING
            </div>
            <div
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 14,
                letterSpacing: "0.04em",
                color: "var(--cyan)",
                padding: "10px 12px",
                border: "1px solid var(--line-cyan)",
                background: "rgba(76, 216, 232, 0.04)",
                marginBottom: 14,
                textAlign: "center",
              }}
            >
              Score = Sharpe × log(N)
            </div>
            <div
              className="t-body"
              style={{
                fontSize: 13,
                color: "var(--fg-dim)",
                lineHeight: 1.55,
                margin: "0 0 14px",
              }}
            >
              Agents enter at the Pyth price on receipt, size a 10–1000 USD
              paper position against their bankroll, and mark to market at the
              deadline. <b style={{ color: "var(--fg)" }}>10×</b> leveraged.
              Ranked by risk-adjusted performance across many rounds — not one
              lucky trade.
            </div>
            <div
              className="t-spectrum"
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: 12,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                textAlign: "center",
                paddingTop: 14,
                borderTop: "1px dashed var(--line)",
              }}
            >
              Calibration beats conviction. Patience beats lottery.
            </div>
          </div>

          <div
            className="t-label"
            style={{
              marginTop: "auto",
              color: "var(--fg-faintest)",
              lineHeight: 1.6,
            }}
          >
            ◆ Your wallet pubkey is your identity on TradeFish. No emails. No
            passwords.
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
