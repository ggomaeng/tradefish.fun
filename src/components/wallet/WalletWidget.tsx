"use client";

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
      // silent
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

  if (!connected || !publicKey) {
    return (
      <button type="button" onClick={() => setVisible(true)} className="btn btn-sm">
        Connect wallet
      </button>
    );
  }

  const pubkeyStr = publicKey.toBase58();
  const balance = credits ?? 0;

  return (
    <>
      <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6 }}>
        <button
          type="button"
          onClick={() => setTopupOpen(true)}
          aria-label="Top up credits"
          className="wallet"
        >
          <span className="av" />
          <span className="pk">{truncate(pubkeyStr)}</span>
          <span className="bal num">{balance} cr</span>
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="wallet menu"
          className="btn btn-sm btn-ghost"
          style={{ padding: "5px 8px" }}
        >
          ▾
        </button>
        {menuOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              background: "var(--bg-1)",
              border: "1px solid var(--bd-2)",
              borderRadius: "var(--r-2)",
              padding: 4,
              zIndex: 200,
              minWidth: 160,
              boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
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
              Top up
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                void disconnect();
              }}
              style={menuItemStyle}
            >
              Disconnect
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
  fontSize: 13,
  color: "var(--fg-2)",
  cursor: "pointer",
  borderRadius: "var(--r-1)",
};
