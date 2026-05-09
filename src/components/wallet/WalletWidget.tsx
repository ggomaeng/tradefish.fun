"use client";

/**
 * WalletWidget — terminal-styled wallet button for the platform nav.
 *
 *  Disconnected → ▸ CONNECT WALLET (opens wallet-adapter modal)
 *  Connected    → Gigz…agSk · 10 cr (clicking opens TopupModal)
 *
 * Balance polling: on connect we fetch /api/credits/balance, and re-fetch
 * after a successful topup. Live deductions on /ask are propagated by the
 * QueryComposer (which exposes refetch via the same endpoint).
 */

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

import { TopupModal } from "./TopupModal";

function truncate(pubkey: string, head = 4, tail = 4) {
  if (pubkey.length <= head + tail + 1) return pubkey;
  return `${pubkey.slice(0, head)}…${pubkey.slice(-tail)}`;
}

export function WalletWidget() {
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [credits, setCredits] = useState<number | null>(null);
  const [topupOpen, setTopupOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
      // silent — nav widget shouldn't crash if balance endpoint blips
    }
  }, [publicKey]);

  useEffect(() => {
    void refetchBalance();
  }, [refetchBalance]);

  // Listen for cross-component balance hints (e.g. after a query debit).
  useEffect(() => {
    function onHint() {
      void refetchBalance();
    }
    window.addEventListener("tradefish:credits-changed", onHint);
    return () =>
      window.removeEventListener("tradefish:credits-changed", onHint);
  }, [refetchBalance]);

  if (!connected || !publicKey) {
    return (
      <button
        type="button"
        onClick={() => setVisible(true)}
        className="tf-cta-ghost"
        style={{ padding: "8px 14px", fontSize: "var(--t-mini)" }}
      >
        ▸ CONNECT WALLET
      </button>
    );
  }

  const pubkeyStr = publicKey.toBase58();
  const balance = credits ?? 0;

  return (
    <>
      <div style={{ position: "relative", display: "inline-flex" }}>
        <button
          type="button"
          onClick={() => setTopupOpen(true)}
          aria-label="Top up credits"
          className="tf-chip tf-chip-cyan"
          style={{
            padding: "6px 10px",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
            background: "var(--surface-glass)",
          }}
        >
          <span aria-hidden style={{ color: "var(--cyan)" }}>
            ◆
          </span>
          <span style={{ color: "var(--fg)" }}>{truncate(pubkeyStr)}</span>
          <span style={{ color: "var(--fg-faint)" }}>·</span>
          <span style={{ color: "var(--cyan)" }}>{balance} cr</span>
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="wallet menu"
          style={{
            marginLeft: 4,
            padding: "0 6px",
            background: "transparent",
            border: "1px solid var(--line)",
            color: "var(--fg-faint)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--t-mini)",
            cursor: "pointer",
          }}
        >
          ▾
        </button>
        {menuOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              background: "var(--surface-deep)",
              border: "1px solid var(--line-strong)",
              padding: 6,
              zIndex: 200,
              minWidth: 160,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setTopupOpen(true);
              }}
              style={menuItemStyle}
            >
              ▸ TOP UP
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                void disconnect();
              }}
              style={menuItemStyle}
            >
              ▸ DISCONNECT
            </button>
          </div>
        )}
      </div>

      <TopupModal
        open={topupOpen}
        onClose={() => {
          setTopupOpen(false);
          void refetchBalance();
        }}
        onSuccess={(c) => {
          setCredits(c);
          // Let any composer on the page refetch too.
          window.dispatchEvent(new CustomEvent("tradefish:credits-changed"));
        }}
      />
    </>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "transparent",
  border: "none",
  padding: "8px 10px",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--t-mini)",
  letterSpacing: "0.18em",
  color: "var(--fg-dim)",
  cursor: "pointer",
};
