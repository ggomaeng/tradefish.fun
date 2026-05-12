"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { explorerClusterQuery, getTreasuryPubkey } from "@/lib/solana-config";
import { useSolBalance, formatSol } from "@/components/wallet/useSolBalance";

const AMOUNTS: { sol: number; lamports: number; credits: number; label: string }[] = [
  { sol: 0.01, lamports: 10_000_000,  credits: 10,  label: "" },
  { sol: 0.05, lamports: 50_000_000,  credits: 50,  label: "most picked" },
  { sol: 0.10, lamports: 100_000_000, credits: 100, label: "" },
];
const NETWORK_FEE_SOL = 0.00001;

type Phase =
  | { kind: "idle" }
  | { kind: "signing" }
  | { kind: "confirming"; signature: string }
  | { kind: "verifying"; signature: string }
  | { kind: "success"; signature: string; credits: number }
  | { kind: "error"; message: string; signature?: string };

function truncate(pubkey: string, head = 4, tail = 4) {
  if (pubkey.length <= head + tail + 1) return pubkey;
  return `${pubkey.slice(0, head)}…${pubkey.slice(-tail)}`;
}

function explorerUrl(signature: string) {
  return `https://explorer.solana.com/tx/${signature}${explorerClusterQuery()}`;
}

export function TopupModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: (credits: number) => void;
}) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const { sol: walletSol } = useSolBalance();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [selectedIdx, setSelectedIdx] = useState(1); // default: 0.05 SOL

  useEffect(() => {
    if (!open) {
      setPhase({ kind: "idle" });
      setSelectedIdx(1);
    }
  }, [open]);

  const selected = AMOUNTS[selectedIdx];

  const handleTopup = useCallback(async () => {
    if (!connected || !publicKey) {
      setPhase({ kind: "error", message: "Wallet not connected." });
      return;
    }
    const treasuryPubkey = getTreasuryPubkey();
    if (!treasuryPubkey) {
      setPhase({ kind: "error", message: "Treasury env var missing." });
      return;
    }

    let treasury: PublicKey;
    try {
      treasury = new PublicKey(treasuryPubkey);
    } catch {
      setPhase({ kind: "error", message: "Invalid treasury pubkey." });
      return;
    }

    setPhase({ kind: "signing" });

    let signature = "";
    try {
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");

      const tx = new Transaction({
        feePayer: publicKey,
        blockhash,
        lastValidBlockHeight,
      }).add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: treasury,
          lamports: selected.lamports,
        }),
      );

      signature = await sendTransaction(tx, connection as Connection);
      setPhase({ kind: "confirming", signature });

      const confirmation = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
      );
      if (confirmation.value.err) {
        throw new Error(
          `Tx failed on-chain: ${JSON.stringify(confirmation.value.err)}`,
        );
      }

      setPhase({ kind: "verifying", signature });

      const result = await postTopupWithRetry(signature, publicKey.toBase58());
      const newCredits =
        typeof result.credits === "number" ? result.credits : selected.credits;

      setPhase({ kind: "success", signature, credits: newCredits });
      onSuccess?.(newCredits);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setPhase({ kind: "error", message, signature: signature || undefined });
    }
  }, [connected, publicKey, connection, sendTransaction, onSuccess, selected]);

  if (!open) return null;

  const busy =
    phase.kind === "signing" ||
    phase.kind === "confirming" ||
    phase.kind === "verifying";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Top up SOL"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10,10,11,0.65)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--bg-1)",
          border: "1px solid var(--bd-2)",
          borderRadius: "var(--r-4)",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Head */}
        <div style={{ padding: "22px 24px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h3 className="t-h3" style={{ margin: 0, fontSize: 18 }}>Top up SOL</h3>
            <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>
              Sent to TradeFish treasury · spent on rounds
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--fg-3)",
              fontSize: 20,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        {/* Amount picker */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, padding: "0 24px 20px" }}>
          {AMOUNTS.map((amt, i) => {
            const sel = i === selectedIdx;
            return (
              <button
                key={amt.sol}
                type="button"
                onClick={() => setSelectedIdx(i)}
                disabled={busy}
                style={{
                  padding: "16px 12px",
                  textAlign: "center",
                  background: sel ? "rgba(94,234,240,0.04)" : "var(--bg-2)",
                  border: `1px solid ${sel ? "var(--cyan)" : "var(--bd-1)"}`,
                  borderRadius: "var(--r-3)",
                  cursor: busy ? "not-allowed" : "pointer",
                  color: "var(--fg)",
                  transition: "all 120ms",
                }}
              >
                <div className="num" style={{ fontSize: 18, fontWeight: 500 }}>{amt.sol} SOL</div>
                <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 4 }}>
                  {amt.credits} credits{amt.label ? ` · ${amt.label}` : ""}
                </div>
              </button>
            );
          })}
        </div>

        {/* Rows */}
        <div style={{ padding: "8px 24px", borderTop: "1px solid var(--bd-1)" }}>
          <div style={rowStyle}>
            <span style={{ color: "var(--fg-3)" }}>Amount</span>
            <span className="num">{selected.sol.toFixed(5)} SOL</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: "var(--fg-3)" }}>Network fee</span>
            <span className="num">≈ {NETWORK_FEE_SOL} SOL</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: "var(--fg-3)" }}>Credits granted</span>
            <span className="num" style={{ color: "var(--cyan)" }}>+ {selected.credits}</span>
          </div>
          <div style={{ ...rowStyle, borderTop: "1px solid var(--bd-1)", marginTop: 4, fontWeight: 500, color: "var(--fg)", paddingTop: 14 }}>
            <span>Total</span>
            <span className="num">{(selected.sol + NETWORK_FEE_SOL).toFixed(5)} SOL</span>
          </div>
        </div>

        {/* Status line */}
        <div style={{ padding: "6px 24px 12px", fontSize: 12, minHeight: 22, color: "var(--fg-2)" }}>
          <PhaseStatus phase={phase} walletSol={walletSol} />
        </div>

        {/* Foot */}
        <div style={{ padding: "16px 24px", background: "var(--bg-2)", borderTop: "1px solid var(--bd-1)", display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost"
            style={{ flex: 1, justifyContent: "center", padding: 10 }}
            disabled={busy}
          >
            Cancel
          </button>
          {phase.kind === "success" ? (
            <button
              type="button"
              onClick={onClose}
              className="btn btn-primary"
              style={{ flex: 2, justifyContent: "center", padding: 10 }}
            >
              Done →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleTopup}
              className="btn btn-primary"
              style={{ flex: 2, justifyContent: "center", padding: 10 }}
              disabled={busy || !connected}
            >
              ◆ {phaseLabel(phase)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "10px 0",
  fontSize: 13,
};

function phaseLabel(phase: Phase): string {
  switch (phase.kind) {
    case "signing":    return "Signing…";
    case "confirming": return "Confirming…";
    case "verifying":  return "Verifying…";
    case "error":      return "Retry";
    default:           return "Sign & send";
  }
}

function PhaseStatus({ phase, walletSol }: { phase: Phase; walletSol: number | null }) {
  if (phase.kind === "idle") {
    return (
      <span style={{ color: "var(--fg-3)" }}>
        Wallet:{" "}
        <span className="num" style={{ color: "var(--fg-2)" }}>
          {formatSol(walletSol)} SOL
        </span>
      </span>
    );
  }
  if (phase.kind === "signing") {
    return <span>Confirm the transaction in your wallet…</span>;
  }
  if (phase.kind === "confirming" || phase.kind === "verifying") {
    return (
      <span>
        {phase.kind === "confirming" ? "Waiting for cluster…" : "Verifying transfer…"}{" "}
        <a href={explorerUrl(phase.signature)} target="_blank" rel="noreferrer" style={{ color: "var(--cyan)" }}>
          {truncate(phase.signature, 6, 6)}
        </a>
      </span>
    );
  }
  if (phase.kind === "success") {
    return (
      <span style={{ color: "var(--up)" }}>
        ✓ Credited. Balance: {phase.credits} cr ·{" "}
        <a href={explorerUrl(phase.signature)} target="_blank" rel="noreferrer" style={{ color: "var(--cyan)" }}>
          tx
        </a>
      </span>
    );
  }
  return (
    <span style={{ color: "var(--down)" }}>
      ⚠ {phase.message}
      {phase.signature ? (
        <>
          {" "}·{" "}
          <a href={explorerUrl(phase.signature)} target="_blank" rel="noreferrer" style={{ color: "var(--cyan)" }}>
            tx
          </a>
        </>
      ) : null}
    </span>
  );
}

async function postTopupWithRetry(
  signature: string,
  wallet_pubkey: string,
): Promise<{ ok: boolean; credits?: number; error?: string }> {
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const r = await fetch("/api/credits/topup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signature, wallet_pubkey }),
    });
    const json = await r.json().catch(() => ({}));
    if (r.ok) return json;
    if (r.status === 404 && attempt < maxAttempts - 1) {
      await new Promise((res) => setTimeout(res, 1500));
      continue;
    }
    throw new Error(json.error ?? `Topup failed (${r.status})`);
  }
  throw new Error("Topup verification timed out");
}
