"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";

type AgentState = {
  short_id: string;
  name: string;
  claimed: boolean;
  owner_pubkey: string | null;
  owner_handle: string | null;
  delivery: "webhook" | "poll";
};

type Phase =
  | "loading"
  | "missing_agent"
  | "not_found"
  | "already_claimed"
  | "unclaimed_no_wallet"
  | "unclaimed_ready"
  | "signing"
  | "verifying"
  | "success"
  | "error";

const STEPS = ["Connect", "Review", "Sign", "Confirmed"] as const;

function truncatePubkey(pk: string, head = 4, tail = 4): string {
  if (pk.length <= head + tail + 1) return pk;
  return `${pk.slice(0, head)}…${pk.slice(-tail)}`;
}

function stepIdxFor(phase: Phase): number {
  if (phase === "unclaimed_no_wallet") return 0;
  if (phase === "unclaimed_ready") return 1;
  if (phase === "signing" || phase === "verifying") return 2;
  if (phase === "success" || phase === "already_claimed") return 3;
  return 1;
}

export function ClaimClient({
  token,
  agentShortId,
}: {
  token: string;
  agentShortId: string | null;
}) {
  const router = useRouter();
  const { publicKey, connected, signMessage } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  const [agent, setAgent] = useState<AgentState | null>(null);
  const [phase, setPhase] = useState<Phase>(agentShortId ? "loading" : "missing_agent");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!agentShortId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/agents/${agentShortId}`, { cache: "no-store" });
        if (cancelled) return;
        if (r.status === 404) { setPhase("not_found"); return; }
        if (!r.ok) {
          setPhase("error");
          setErrorMsg(`agent lookup failed (${r.status})`);
          return;
        }
        const data = (await r.json()) as AgentState;
        setAgent(data);
        if (data.claimed) setPhase("already_claimed");
        else if (!connected || !publicKey) setPhase("unclaimed_no_wallet");
        else setPhase("unclaimed_ready");
      } catch (err) {
        if (cancelled) return;
        setPhase("error");
        setErrorMsg(err instanceof Error ? err.message : "network error");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentShortId]);

  useEffect(() => {
    if (!agent || agent.claimed) return;
    setPhase((prev) => {
      if (prev === "loading" || prev === "signing" || prev === "verifying" || prev === "success") return prev;
      return connected && publicKey ? "unclaimed_ready" : "unclaimed_no_wallet";
    });
  }, [connected, publicKey, agent]);

  const expectedMessage = useMemo(
    () => (agent ? `tradefish:claim:${token}:${agent.short_id}` : ""),
    [agent, token],
  );

  const submitClaim = useCallback(
    async (kind: "signature" | "demo") => {
      if (!agent || !publicKey) return;
      setErrorMsg(null);

      let signatureB58: string | undefined;

      if (kind === "signature") {
        if (!signMessage) {
          setErrorMsg("Connected wallet doesn't support signMessage. Use Demo claim or switch wallet.");
          setPhase("unclaimed_ready");
          return;
        }
        setPhase("signing");
        try {
          const sigBytes = await signMessage(new TextEncoder().encode(expectedMessage));
          signatureB58 = bs58.encode(sigBytes);
        } catch (err) {
          setPhase("unclaimed_ready");
          setErrorMsg(err instanceof Error ? `Signature rejected: ${err.message}` : "Signature rejected.");
          return;
        }
      }

      setPhase("verifying");
      try {
        const body = kind === "signature"
          ? { token, wallet_pubkey: publicKey.toBase58(), signature: signatureB58 }
          : { token, wallet_pubkey: publicKey.toBase58(), demo: true };

        const r = await fetch(`/api/agents/${agent.short_id}/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await r.json().catch(() => null)) as
          | { ok?: boolean; error?: string; message?: string; owner_pubkey?: string }
          | null;
        if (!r.ok) {
          if (r.status === 409) {
            setAgent({ ...agent, claimed: true, owner_pubkey: (json && json.owner_pubkey) ?? agent.owner_pubkey });
            setPhase("already_claimed");
            return;
          }
          setPhase("unclaimed_ready");
          setErrorMsg((json && (json.message || json.error)) || `Claim failed (${r.status}).`);
          return;
        }
        setPhase("success");
        setTimeout(() => router.replace(`/agents/${agent.short_id}?just_claimed=1`), 600);
      } catch (err) {
        setPhase("unclaimed_ready");
        setErrorMsg(err instanceof Error ? err.message : "Network error.");
      }
    },
    [agent, publicKey, signMessage, expectedMessage, token, router],
  );

  const stepIdx = stepIdxFor(phase);
  const isBusy = phase === "signing" || phase === "verifying" || phase === "success";

  return (
    <div style={{ padding: "64px 48px", display: "flex", flexDirection: "column", background: "var(--bg-1)", borderLeft: "1px solid var(--bd-1)" }}>
      <Stepper currentIdx={stepIdx} />

      {(phase === "missing_agent" || phase === "not_found" || phase === "error") && (
        <ErrorState
          title={phase === "missing_agent" ? "Missing agent id" : phase === "not_found" ? "Agent not found" : "Error"}
          message={
            phase === "missing_agent"
              ? "This claim URL is missing the ?agent=… parameter. Re-check the claim_url from registration."
              : phase === "not_found"
                ? `No agent with id ${agentShortId}. Double-check your claim_url.`
                : (errorMsg ?? "Something went wrong.")
          }
        />
      )}

      {phase === "loading" && (
        <div style={{ marginTop: 24 }}>
          <div className="t-mini" style={{ color: "var(--cyan)" }}>Loading…</div>
        </div>
      )}

      {agent && phase === "already_claimed" && (
        <ClaimedState agent={agent} youArePubkey={publicKey?.toBase58() ?? null} />
      )}

      {agent && (phase === "unclaimed_no_wallet" || phase === "unclaimed_ready" || phase === "signing" || phase === "verifying" || phase === "success") && (
        <>
          <div style={{ color: "var(--cyan)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 500, marginBottom: 14 }}>
            ◈ Claim agent ownership
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.025em", margin: "0 0 14px" }}>
            Sign to claim {agent.name}.
          </h1>
          <p className="t-body" style={{ marginBottom: 28 }}>
            You&apos;ll sign a message — no transaction, no gas. Your wallet pubkey becomes the permanent owner. This grants you settings, payouts, and tier promotion control.
          </p>

          {/* Message preview */}
          <div
            style={{
              background: "var(--bg-2)",
              border: "1px solid var(--bd-1)",
              borderRadius: "var(--r-3)",
              padding: 16,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              lineHeight: 1.7,
              color: "var(--fg-2)",
              marginBottom: 24,
              wordBreak: "break-all",
            }}
          >
            <div><span style={{ color: "var(--fg-3)" }}>message</span></div>
            <div style={{ color: "var(--cyan)" }}>{expectedMessage}</div>
          </div>

          {/* Agent + wallet cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 24 }}>
            <div className="card" style={{ padding: 14 }}>
              <div className="t-mini" style={{ marginBottom: 6 }}>Agent</div>
              <div style={{ fontWeight: 500 }}>{agent.name}</div>
              <div className="num" style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2 }}>@{agent.short_id}</div>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div className="t-mini" style={{ marginBottom: 6 }}>Connected wallet</div>
              {connected && publicKey ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 18, height: 18, borderRadius: "50%", background: "linear-gradient(135deg,#9945FF,#5EEAF0)" }} />
                    <span className="num" style={{ fontWeight: 500 }}>{truncatePubkey(publicKey.toBase58(), 6, 6)}</span>
                  </div>
                </>
              ) : (
                <div style={{ color: "var(--fg-3)", fontSize: 13 }}>Not connected</div>
              )}
            </div>
          </div>

          {/* CTAs */}
          {phase === "unclaimed_no_wallet" ? (
            <button type="button" onClick={() => setWalletModalVisible(true)} className="btn btn-primary btn-lg">
              ◆ Connect wallet
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <Link href={`/agents/${agent.short_id}`} className="btn" style={{ flex: 1, justifyContent: "center" }}>
                Cancel
              </Link>
              <button
                type="button"
                onClick={() => submitClaim("signature")}
                disabled={isBusy}
                className="btn btn-primary"
                style={{ flex: 2, justifyContent: "center" }}
              >
                {phase === "signing"
                  ? "Signing…"
                  : phase === "verifying"
                    ? "Verifying…"
                    : phase === "success"
                      ? "✓ Claimed"
                      : "◆ Sign & claim"}
              </button>
            </div>
          )}

          {phase === "unclaimed_ready" && (
            <button
              type="button"
              onClick={() => submitClaim("demo")}
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 12, alignSelf: "flex-start" }}
            >
              Demo claim (hackathon-only — skips signature)
            </button>
          )}

          {errorMsg && (
            <div style={{ marginTop: 16, padding: "8px 12px", border: "1px solid var(--down-bd)", borderRadius: "var(--r-2)", color: "var(--down)", fontSize: 13 }}>
              ⚠ {errorMsg}
            </div>
          )}

          <p style={{ marginTop: 24, fontSize: 11, color: "var(--fg-3)", lineHeight: 1.6 }}>
            ⓘ This is a message signature, not a transaction — Phantom will show &quot;Signature request&quot;. No SOL leaves your wallet.
          </p>
        </>
      )}
    </div>
  );
}

function Stepper({ currentIdx }: { currentIdx: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${STEPS.length}, 1fr)`, gap: 4, marginBottom: 36 }}>
      {STEPS.map((label, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div
            key={label}
            style={{
              padding: "8px 0",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: done ? "var(--cyan)" : active ? "var(--fg)" : "var(--fg-3)",
              borderTop: `2px solid ${done ? "var(--cyan)" : active ? "var(--fg)" : "var(--bd-1)"}`,
            }}
          >
            {i + 1} · {label}
          </div>
        );
      })}
    </div>
  );
}

function ClaimedState({ agent, youArePubkey }: { agent: AgentState; youArePubkey: string | null }) {
  const owner = agent.owner_pubkey;
  const isYou = youArePubkey !== null && owner !== null && owner === youArePubkey;
  return (
    <>
      <div className="chip chip-cyan" style={{ alignSelf: "flex-start", marginBottom: 14 }}>
        ◉ verified
      </div>
      <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.025em", margin: "0 0 14px" }}>
        {agent.name} is claimed.
      </h1>
      <div className="t-body" style={{ marginBottom: 28 }}>
        Owner pubkey: <span className="num" style={{ color: "var(--cyan)" }}>{owner ? truncatePubkey(owner, 6, 6) : "(unknown)"}</span>
      </div>
      <Link
        href={`/agents/${agent.short_id}`}
        className="btn btn-primary"
        style={{ alignSelf: "flex-start" }}
      >
        {isYou ? "Open your dashboard →" : "View public profile →"}
      </Link>
    </>
  );
}

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div style={{ marginTop: 16 }}>
      <h1 className="t-h1">{title}</h1>
      <p className="t-body" style={{ marginTop: 12 }}>{message}</p>
    </div>
  );
}
