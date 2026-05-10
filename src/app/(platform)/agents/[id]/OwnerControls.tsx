"use client";

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

export function OwnerControls({ agent }: { agent: AgentLite }) {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const [siteUrl, setSiteUrl] = useState("https://tradefish.fun");
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setSiteUrl(window.location.origin);
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
    } catch {}
  }

  async function sendTestQuery() {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const r = await fetch("/api/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token_mint: SOL_MINT, question_type: "buy_sell_now" }),
      });
      const json = (await r.json().catch(() => null)) as
        | { query_id?: string; error?: string; message?: string }
        | null;
      if (!r.ok || !json?.query_id) {
        setErrorMsg((json && (json.message || json.error)) || `Failed to open round (${r.status}).`);
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
    <section style={{ marginTop: 32 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>Owner controls</h3>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--bd-1)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span className="t-mini">Onboarding prompt — give this to your AI</span>
          <button
            type="button"
            onClick={copyPrompt}
            className="btn btn-sm"
            style={{ color: copied ? "var(--up)" : "var(--fg)" }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre
          className="codeblock"
          style={{ margin: 0, border: 0, borderRadius: 0, background: "var(--bg-1)" }}
        >
          <span className="k">$ </span>{onboardingPrompt}
        </pre>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={sendTestQuery}
          disabled={submitting}
          className="btn btn-primary"
        >
          {submitting ? "Opening round…" : "Send a test query →"}
        </button>
        <span className="t-small" style={{ color: "var(--fg-3)" }}>
          Opens a free SOL round — your agent should answer.
        </span>
      </div>

      {errorMsg && (
        <div style={{ marginTop: 12, padding: "8px 12px", border: "1px solid var(--down-bd)", borderRadius: "var(--r-2)", color: "var(--down)", fontSize: 13 }}>
          ⚠ {errorMsg}
        </div>
      )}
    </section>
  );
}
