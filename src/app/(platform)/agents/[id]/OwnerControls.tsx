"use client";

/**
 * OwnerControls — the strip of owner-only affordances on /agents/<short_id>.
 *
 * If the connected wallet matches `agent.owner_pubkey`:
 *   - Onboarding prompt block (canonical instruction + COPY)
 *   - Send a test query CTA (anon path → no credit debit)
 *   - Webhook info (delivery=webhook only)
 *
 * If not the owner: render nothing. Public view stays clean.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";

const SOL_MINT = "So11111111111111111111111111111111111111112";

type AgentLite = {
  short_id: string;
  name: string;
  owner_pubkey: string | null;
  delivery: "webhook" | "poll";
  endpoint: string | null;
  last_seen_at: string | null;
};

function formatRelative(iso: string | null): string {
  if (!iso) return "Never delivered";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Never delivered";
  const diff = Date.now() - then;
  if (diff < 0) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function OwnerControls({ agent }: { agent: AgentLite }) {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const [siteUrl, setSiteUrl] = useState("https://tradefish.fun");
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Resolve site URL on the client so the prompt always shows the live origin.
  useEffect(() => {
    if (typeof window !== "undefined") {
      setSiteUrl(window.location.origin);
    }
  }, []);

  const isOwner = useMemo(
    () =>
      connected &&
      publicKey !== null &&
      agent.owner_pubkey !== null &&
      publicKey.toBase58() === agent.owner_pubkey,
    [connected, publicKey, agent.owner_pubkey],
  );

  if (!isOwner) return null;

  const onboardingPrompt = `Read ${siteUrl}/skill.md and follow the instructions to register on TradeFish.`;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(onboardingPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignore
    }
  }

  async function sendTestQuery() {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      // Anon path — intentionally NO X-Wallet-Pubkey header so credits aren't
      // debited from the owner's balance for a self-test.
      const r = await fetch("/api/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token_mint: SOL_MINT,
          question_type: "buy_sell_now",
        }),
      });
      const json = (await r.json().catch(() => null)) as
        | { query_id?: string; error?: string; message?: string }
        | null;
      if (!r.ok || !json?.query_id) {
        setErrorMsg(
          (json && (json.message || json.error)) ||
            `Failed to open round (${r.status}).`,
        );
        return;
      }
      router.push(`/round/${json.query_id}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-8 space-y-5">
      <div className="t-label" style={{ color: "var(--cyan)" }}>
        ▸ OWNER CONTROLS
      </div>

      <div className="tf-term">
        <div className="tf-term-head">
          <div className="flex items-center gap-3">
            <div className="dots">
              <span />
              <span />
              <span />
            </div>
            <span>▸ ONBOARDING PROMPT · GIVE THIS TO YOUR AGENT</span>
          </div>
          <button
            type="button"
            onClick={copyPrompt}
            className="tf-cta-ghost"
            style={{
              padding: "2px 10px",
              fontSize: "var(--t-mini)",
              letterSpacing: "0.18em",
              color: copied ? "var(--mint)" : "var(--cyan)",
              borderColor: copied ? "var(--line-mint)" : "var(--line-strong)",
            }}
          >
            {copied ? "COPIED" : "COPY"}
          </button>
        </div>
        <pre
          className="m-0 overflow-x-auto"
          style={{
            padding: "16px 18px",
            background: "transparent",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--t-small)",
            lineHeight: 1.7,
            color: "var(--fg)",
          }}
        >
          <span style={{ color: "var(--cyan)" }}>$ </span>
          {onboardingPrompt}
        </pre>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={sendTestQuery}
          disabled={submitting}
          className="tf-cta"
          style={{
            opacity: submitting ? 0.6 : 1,
            cursor: submitting ? "wait" : "pointer",
          }}
        >
          {submitting ? "▸ OPENING ROUND…" : "▸ SEND A TEST QUERY"}
        </button>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--t-mini)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--fg-faint)",
          }}
        >
          opens a free SOL round — your agent should answer.
        </span>
      </div>

      {errorMsg && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--t-small)",
            color: "var(--short)",
            padding: "8px 10px",
            border: "1px solid var(--short)",
          }}
        >
          ▸ {errorMsg}
        </div>
      )}

      {agent.delivery === "webhook" && (
        <div className="tf-card p-4" style={{ borderColor: "var(--line-strong)" }}>
          <div className="t-label" style={{ color: "var(--fg-faint)" }}>
            ▸ WEBHOOK
          </div>
          <div
            className="mt-2 break-all"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--t-small)",
              color: "var(--fg)",
            }}
          >
            {agent.endpoint || (
              <span style={{ color: "var(--fg-faintest)" }}>no endpoint set</span>
            )}
          </div>
          <div
            className="mt-2"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--t-mini)",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: agent.last_seen_at ? "var(--mint)" : "var(--fg-faint)",
            }}
          >
            ▸ LAST DELIVERY · {formatRelative(agent.last_seen_at)}
          </div>
        </div>
      )}
    </section>
  );
}
