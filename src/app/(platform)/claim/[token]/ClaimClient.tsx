"use client";

/**
 * ClaimClient — wallet-signature claim flow.
 *
 * State machine:
 *   loading             → fetching /api/agents/<id>
 *   missing_agent       → URL had no ?agent=...
 *   not_found           → agent does not exist
 *   already_claimed     → agent.owner_pubkey is set
 *   unclaimed_no_wallet → connect wallet to proceed
 *   unclaimed_ready     → wallet connected, show SIGN & CLAIM / DEMO CLAIM
 *   signing             → asking wallet to sign
 *   verifying           → POST /claim
 *   success             → claim recorded; redirecting
 *   error               → show inline error
 *
 * The signed message is the literal UTF-8 string:
 *   tradefish:claim:<token>:<short_id>
 */

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

function truncatePubkey(pk: string, head = 4, tail = 4): string {
  if (pk.length <= head + tail + 1) return pk;
  return `${pk.slice(0, head)}…${pk.slice(-tail)}`;
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
  const [phase, setPhase] = useState<Phase>(
    agentShortId ? "loading" : "missing_agent",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1) Initial fetch of public agent state.
  useEffect(() => {
    if (!agentShortId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/agents/${agentShortId}`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (r.status === 404) {
          setPhase("not_found");
          return;
        }
        if (!r.ok) {
          setPhase("error");
          setErrorMsg(`agent lookup failed (${r.status})`);
          return;
        }
        const data = (await r.json()) as AgentState;
        setAgent(data);
        if (data.claimed) {
          setPhase("already_claimed");
        } else if (!connected || !publicKey) {
          setPhase("unclaimed_no_wallet");
        } else {
          setPhase("unclaimed_ready");
        }
      } catch (err) {
        if (cancelled) return;
        setPhase("error");
        setErrorMsg(err instanceof Error ? err.message : "network error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // We deliberately don't depend on connected/publicKey here — the next
    // effect handles wallet transitions after the initial load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentShortId]);

  // 2) Once loaded, react to wallet connect/disconnect transitions.
  useEffect(() => {
    if (!agent || agent.claimed) return;
    setPhase((prev) => {
      if (
        prev === "loading" ||
        prev === "signing" ||
        prev === "verifying" ||
        prev === "success"
      ) {
        return prev;
      }
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
          setErrorMsg(
            "Connected wallet does not support signMessage. Use DEMO CLAIM or switch wallet.",
          );
          setPhase("unclaimed_ready");
          return;
        }
        setPhase("signing");
        try {
          const messageBytes = new TextEncoder().encode(expectedMessage);
          const sigBytes = await signMessage(messageBytes);
          signatureB58 = bs58.encode(sigBytes);
        } catch (err) {
          setPhase("unclaimed_ready");
          setErrorMsg(
            err instanceof Error
              ? `Signature rejected: ${err.message}`
              : "Signature rejected.",
          );
          return;
        }
      }

      setPhase("verifying");
      try {
        const body =
          kind === "signature"
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
            setAgent({
              ...agent,
              claimed: true,
              owner_pubkey: (json && json.owner_pubkey) ?? agent.owner_pubkey,
            });
            setPhase("already_claimed");
            return;
          }
          setPhase("unclaimed_ready");
          setErrorMsg(
            (json && (json.message || json.error)) ||
              `Claim failed (${r.status}).`,
          );
          return;
        }
        setPhase("success");
        // brief delay so the success state is visible before the redirect
        setTimeout(() => {
          router.replace(`/agents/${agent.short_id}?just_claimed=1`);
        }, 600);
      } catch (err) {
        setPhase("unclaimed_ready");
        setErrorMsg(err instanceof Error ? err.message : "Network error.");
      }
    },
    [agent, publicKey, signMessage, expectedMessage, token, router],
  );

  // -------- render --------

  if (phase === "missing_agent") {
    return (
      <Panel tone="warn" title="▸ MISSING AGENT ID">
        This claim URL is missing the <code>?agent=…</code> parameter. Re-check the
        registration response — the <code>claim_url</code> includes both the token
        and the agent id.
      </Panel>
    );
  }

  if (phase === "loading") {
    return (
      <Panel tone="muted" title="▸ LOADING AGENT">
        Fetching agent state…
      </Panel>
    );
  }

  if (phase === "not_found") {
    return (
      <Panel tone="warn" title="▸ AGENT NOT FOUND">
        No agent with id <code>{agentShortId}</code>. Double-check the
        <code>claim_url</code> from your registration response.
      </Panel>
    );
  }

  if (phase === "error") {
    return (
      <Panel tone="warn" title="▸ ERROR">
        {errorMsg ?? "Something went wrong."}
      </Panel>
    );
  }

  if (!agent) return null;

  // STATE A — already claimed
  if (phase === "already_claimed") {
    const owner = agent.owner_pubkey ?? null;
    const isYou =
      connected &&
      publicKey !== null &&
      owner !== null &&
      owner === publicKey.toBase58();
    return (
      <div className="mt-8 space-y-5">
        <div className="tf-term">
          <div className="tf-term-head">
            <div className="flex items-center gap-3">
              <div className="dots">
                <span />
                <span />
                <span />
              </div>
              <span>✓ CLAIMED · {agent.name}</span>
            </div>
            <span style={{ color: "var(--fg-faint)" }}>{agent.short_id}</span>
          </div>
          <div className="tf-term-body" style={{ padding: "16px 18px" }}>
            <Row label="OWNER">
              <span style={{ color: "var(--fg)", fontFamily: "var(--font-mono)" }}>
                {owner ? truncatePubkey(owner, 6, 6) : "(unknown)"}
              </span>
            </Row>
            <Row label="STATUS">
              <span style={{ color: "var(--mint)", fontFamily: "var(--font-mono)" }}>
                ✓ verified
              </span>
            </Row>
          </div>
        </div>

        {isYou ? (
          <Link
            href={`/agents/${agent.short_id}`}
            className="tf-cta inline-flex"
          >
            ▸ THIS IS YOUR AGENT
          </Link>
        ) : (
          <Link
            href={`/agents/${agent.short_id}`}
            className="tf-cta-ghost inline-flex"
          >
            ▸ VIEW PUBLIC PROFILE
          </Link>
        )}
      </div>
    );
  }

  // STATE B — unclaimed, no wallet
  if (phase === "unclaimed_no_wallet") {
    return (
      <div className="mt-8 space-y-5">
        <div className="tf-term">
          <div className="tf-term-head">
            <div className="flex items-center gap-3">
              <div className="dots">
                <span />
                <span />
                <span />
              </div>
              <span>▸ TAKE OWNERSHIP · {agent.name}</span>
            </div>
            <span style={{ color: "var(--fg-faint)" }}>{agent.short_id}</span>
          </div>
          <div
            className="tf-term-body"
            style={{
              padding: "16px 18px",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--t-body)",
              color: "var(--fg-dim)",
              lineHeight: 1.7,
            }}
          >
            Connect your Solana wallet to bind this agent to your pubkey. The wallet you connect becomes its permanent owner.
          </div>
        </div>

        <button
          type="button"
          onClick={() => setWalletModalVisible(true)}
          className="tf-cta"
        >
          ▸ CONNECT WALLET
        </button>

        {errorMsg && <ErrorLine msg={errorMsg} />}
      </div>
    );
  }

  // STATE C — unclaimed, wallet connected (incl. signing/verifying/success)
  const pkStr = publicKey ? publicKey.toBase58() : "";
  const phaseLabel = (() => {
    if (phase === "signing") return "▸ SIGNING…";
    if (phase === "verifying") return "▸ VERIFYING…";
    if (phase === "success") return "✓ CLAIMED — REDIRECTING…";
    return "";
  })();
  const isBusy =
    phase === "signing" || phase === "verifying" || phase === "success";

  return (
    <div className="mt-8 space-y-5">
      <div className="tf-term">
        <div className="tf-term-head">
          <div className="flex items-center gap-3">
            <div className="dots">
              <span />
              <span />
              <span />
            </div>
            <span>▸ TAKE OWNERSHIP · {agent.name}</span>
          </div>
          <span style={{ color: "var(--fg-faint)" }}>{agent.short_id}</span>
        </div>
        <div className="tf-term-body" style={{ padding: "16px 18px" }}>
          <Row label="WALLET">
            <span style={{ color: "var(--fg)", fontFamily: "var(--font-mono)" }}>
              {truncatePubkey(pkStr, 6, 6)}
            </span>
          </Row>
          <Row label="MESSAGE">
            <code
              style={{
                color: "var(--cyan)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--t-small)",
                wordBreak: "break-all",
              }}
            >
              {expectedMessage}
            </code>
          </Row>
        </div>
      </div>

      {phaseLabel && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--t-small)",
            letterSpacing: "0.18em",
            color: phase === "success" ? "var(--mint)" : "var(--cyan)",
          }}
        >
          {phaseLabel}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => submitClaim("signature")}
          disabled={isBusy}
          className="tf-cta"
          style={{
            opacity: isBusy ? 0.5 : 1,
            cursor: isBusy ? "wait" : "pointer",
          }}
        >
          ▸ SIGN &amp; CLAIM
        </button>
        <button
          type="button"
          onClick={() => submitClaim("demo")}
          disabled={isBusy}
          className="tf-cta-ghost"
          style={{
            opacity: isBusy ? 0.5 : 1,
            cursor: isBusy ? "wait" : "pointer",
          }}
        >
          ▸ DEMO CLAIM
        </button>
      </div>

      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--t-mini)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--fg-faintest)",
          lineHeight: 1.6,
        }}
      >
        ▸ DEMO CLAIM · hackathon-only — production requires signature verification.
      </p>

      {errorMsg && <ErrorLine msg={errorMsg} />}
    </div>
  );
}

function Panel({
  tone,
  title,
  children,
}: {
  tone: "muted" | "warn";
  title: string;
  children: React.ReactNode;
}) {
  const color = tone === "warn" ? "var(--magenta)" : "var(--fg-faint)";
  return (
    <div className="mt-8 tf-term">
      <div className="tf-term-head">
        <div className="flex items-center gap-3">
          <div className="dots">
            <span />
            <span />
            <span />
          </div>
          <span style={{ color }}>{title}</span>
        </div>
      </div>
      <div
        className="tf-term-body"
        style={{
          padding: "16px 18px",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--t-body)",
          color: "var(--fg-dim)",
          lineHeight: 1.7,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-baseline gap-3 py-2"
      style={{ borderBottom: "1px dashed var(--line)" }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--t-mini)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--fg-faint)",
          minWidth: 100,
        }}
      >
        {label}
      </div>
      <div className="flex-1 break-all">{children}</div>
    </div>
  );
}

function ErrorLine({ msg }: { msg: string }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "var(--t-small)",
        color: "var(--short)",
        padding: "8px 10px",
        border: "1px solid var(--short)",
      }}
    >
      ▸ {msg}
    </div>
  );
}
