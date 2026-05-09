"use client";

/**
 * TopupModal — buys credits by sending SOL on devnet.
 *
 * Flow:
 *   1. Build a SystemProgram.transfer (10_000_000 lamports → TREASURY).
 *   2. wallet.sendTransaction(tx, connection) — adapter signs + sends.
 *   3. connection.confirmTransaction with the latest blockhash strategy.
 *   4. POST /api/credits/topup { signature, wallet_pubkey } — server re-fetches
 *      the tx and verifies destination + lamports before crediting.
 *   5. Surface the new balance and an explorer link.
 *
 * This component is the user-visible monetization rail — keep it boring,
 * deterministic, and obvious about what it's doing.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

const TREASURY_PUBKEY = process.env.NEXT_PUBLIC_TRADEFISH_TREASURY ?? "";
const LAMPORTS_PER_TOPUP = 10_000_000; // 0.01 SOL
const CREDITS_PER_TOPUP = 10;

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
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
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
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  // Reset state when the modal closes.
  useEffect(() => {
    if (!open) setPhase({ kind: "idle" });
  }, [open]);

  const handleTopup = useCallback(async () => {
    if (!connected || !publicKey) {
      setPhase({ kind: "error", message: "Wallet not connected." });
      return;
    }
    if (!TREASURY_PUBKEY) {
      setPhase({ kind: "error", message: "Treasury env var missing." });
      return;
    }

    let treasury: PublicKey;
    try {
      treasury = new PublicKey(TREASURY_PUBKEY);
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
          lamports: LAMPORTS_PER_TOPUP,
        }),
      );

      // sendTransaction = sign + send via the connected adapter (Phantom/Solflare).
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

      // Server-side verification + credit grant. Retry once if the RPC node
      // hasn't seen the tx yet (404 is the "not found yet" signal).
      const result = await postTopupWithRetry(signature, publicKey.toBase58());
      const newCredits =
        typeof result.credits === "number" ? result.credits : CREDITS_PER_TOPUP;

      setPhase({ kind: "success", signature, credits: newCredits });
      onSuccess?.(newCredits);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setPhase({ kind: "error", message, signature: signature || undefined });
    }
  }, [connected, publicKey, connection, sendTransaction, onSuccess]);

  if (!open) return null;

  const treasuryDisplay = TREASURY_PUBKEY
    ? truncate(TREASURY_PUBKEY, 6, 6)
    : "(unset)";
  const busy =
    phase.kind === "signing" ||
    phase.kind === "confirming" ||
    phase.kind === "verifying";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Top up credits"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 4, 0.78)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        className="tf-term"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480 }}
      >
        <div className="tf-term-head">
          <div className="flex items-center gap-3">
            <div className="dots">
              <span />
              <span />
              <span />
            </div>
            <span>TOP UP · 0.01 SOL → 10 CREDITS</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--fg-faint)",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--t-mini)",
              letterSpacing: "0.18em",
              cursor: "pointer",
            }}
          >
            ESC ✕
          </button>
        </div>

        <div className="p-5" style={{ fontFamily: "var(--font-mono)" }}>
          <div
            style={{
              fontSize: "var(--t-small)",
              color: "var(--fg-dim)",
              lineHeight: 1.7,
            }}
          >
            Send <span style={{ color: "var(--cyan)" }}>0.01 SOL</span> on{" "}
            <span style={{ color: "var(--fg)" }}>devnet</span> to the TradeFish
            treasury. We verify the transaction on-chain, then credit your
            wallet with{" "}
            <span style={{ color: "var(--cyan)" }}>10 credits</span> — enough
            for one <span style={{ color: "var(--fg)" }}>buy/sell</span> round.
          </div>

          <div className="tf-hr" />

          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "6px 16px",
              fontSize: "var(--t-mini)",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            <dt style={{ color: "var(--fg-faint)" }}>Network</dt>
            <dd style={{ color: "var(--fg)", margin: 0 }}>Solana · devnet</dd>
            <dt style={{ color: "var(--fg-faint)" }}>Treasury</dt>
            <dd style={{ color: "var(--fg)", margin: 0 }}>{treasuryDisplay}</dd>
            <dt style={{ color: "var(--fg-faint)" }}>Amount</dt>
            <dd style={{ color: "var(--fg)", margin: 0 }}>0.01 SOL</dd>
            <dt style={{ color: "var(--fg-faint)" }}>You receive</dt>
            <dd style={{ color: "var(--cyan)", margin: 0 }}>10 credits</dd>
          </dl>

          <div className="tf-hr" />

          <div
            style={{
              fontSize: "var(--t-small)",
              minHeight: 22,
              color: "var(--fg-dim)",
            }}
          >
            <PhaseStatus phase={phase} />
          </div>

          <div
            className="mt-5 flex items-center justify-between gap-3"
            style={{ flexWrap: "wrap" }}
          >
            <button
              type="button"
              onClick={onClose}
              className="tf-cta-ghost"
              disabled={busy}
              style={{
                opacity: busy ? 0.4 : 1,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              CANCEL
            </button>
            {phase.kind === "success" ? (
              <button type="button" className="tf-cta" onClick={onClose}>
                DONE <span style={{ opacity: 0.6 }}>→</span>
              </button>
            ) : (
              <button
                type="button"
                className="tf-cta"
                onClick={handleTopup}
                disabled={busy || !connected}
                style={{
                  opacity: busy || !connected ? 0.4 : 1,
                  cursor: busy || !connected ? "not-allowed" : "pointer",
                }}
              >
                {phaseLabel(phase)} <span style={{ opacity: 0.6 }}>→</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function phaseLabel(phase: Phase): string {
  switch (phase.kind) {
    case "signing":
      return "SIGNING…";
    case "confirming":
      return "CONFIRMING…";
    case "verifying":
      return "VERIFYING…";
    case "error":
      return "RETRY";
    default:
      return "▸ SIGN & SEND";
  }
}

function PhaseStatus({ phase }: { phase: Phase }) {
  if (phase.kind === "idle") {
    return (
      <span style={{ color: "var(--fg-faint)" }}>
        ▸ Ready. Devnet faucet:{" "}
        <a
          href="https://faucet.solana.com"
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--cyan)" }}
        >
          faucet.solana.com
        </a>
      </span>
    );
  }
  if (phase.kind === "signing") {
    return (
      <span style={{ color: "var(--fg-dim)" }}>
        ▸ Confirm the transaction in your wallet…
      </span>
    );
  }
  if (phase.kind === "confirming") {
    return (
      <span style={{ color: "var(--fg-dim)" }}>
        ▸ Waiting for cluster confirmation…{" "}
        <a
          href={explorerUrl(phase.signature)}
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--cyan)" }}
        >
          {truncate(phase.signature, 6, 6)}
        </a>
      </span>
    );
  }
  if (phase.kind === "verifying") {
    return (
      <span style={{ color: "var(--fg-dim)" }}>
        ▸ Server is verifying the transfer…{" "}
        <a
          href={explorerUrl(phase.signature)}
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--cyan)" }}
        >
          {truncate(phase.signature, 6, 6)}
        </a>
      </span>
    );
  }
  if (phase.kind === "success") {
    return (
      <span style={{ color: "var(--mint, #4CE8AC)" }}>
        ✓ Credited. Balance: {phase.credits} cr ·{" "}
        <a
          href={explorerUrl(phase.signature)}
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--cyan)" }}
        >
          tx
        </a>
      </span>
    );
  }
  // error
  return (
    <span style={{ color: "var(--short, #E84CC9)" }}>
      ⚠ {phase.message}
      {phase.signature ? (
        <>
          {" "}
          ·{" "}
          <a
            href={explorerUrl(phase.signature)}
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--cyan)" }}
          >
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
    // 404 = RPC hasn't seen tx yet; back off and retry.
    if (r.status === 404 && attempt < maxAttempts - 1) {
      await new Promise((res) => setTimeout(res, 1500));
      continue;
    }
    throw new Error(json.error ?? `Topup failed (${r.status})`);
  }
  throw new Error("Topup verification timed out");
}
