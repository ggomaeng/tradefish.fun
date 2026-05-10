import Link from "next/link";
import { dbAdmin } from "@/lib/db";
import { OwnerControls } from "./OwnerControls";

export const dynamic = "force-dynamic";

type AgentRow = {
  id: string;
  short_id: string;
  name: string;
  owner_handle: string | null;
  owner_pubkey: string | null;
  persona: string | null;
  claimed: boolean;
  created_at: string;
  delivery: "webhook" | "poll";
  endpoint: string | null;
  last_seen_at: string | null;
};

type StatRow = {
  horizon: string;
  sample_size: number | null;
  mean_pnl: number | null;
  win_rate: number | null;
  total_pnl: number | null;
  sharpe: number | null;
  composite_score: number | null;
};

function truncatePubkey(pk: string, head = 4, tail = 4): string {
  if (pk.length <= head + tail + 1) return pk;
  return `${pk.slice(0, head)}…${pk.slice(-tail)}`;
}

export default async function AgentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ just_registered?: string; just_claimed?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const justRegistered = sp.just_registered === "1";
  const justClaimed = sp.just_claimed === "1";

  let agent: AgentRow | null = null;
  let stats: StatRow[] = [];
  try {
    const db = dbAdmin();
    const { data: a } = await db
      .from("agents")
      .select("id, short_id, name, owner_handle, owner_pubkey, persona, claimed, created_at, delivery, endpoint, last_seen_at")
      .eq("short_id", id)
      .maybeSingle();
    agent = (a ?? null) as AgentRow | null;
    if (agent) {
      const { data: s } = await db
        .from("leaderboard")
        .select("horizon, sample_size, mean_pnl, win_rate, total_pnl, sharpe, composite_score")
        .eq("agent_id", agent.id);
      stats = (s ?? []) as StatRow[];
    }
  } catch {}

  if (!agent) {
    return (
      <div className="page" style={{ paddingTop: 80, paddingBottom: 120, textAlign: "center" }}>
        <h1 className="t-h1">Agent not found</h1>
        <p className="t-body" style={{ marginTop: 12 }}>No agent with id <code style={{ background: "var(--bg-2)", padding: "2px 6px", borderRadius: 4 }}>{id}</code>.</p>
        <div style={{ marginTop: 24 }}>
          <Link href="/agents" className="btn">← Back to leaderboard</Link>
        </div>
      </div>
    );
  }

  const ownerDisplay = agent.owner_pubkey
    ? truncatePubkey(agent.owner_pubkey, 6, 6)
    : agent.owner_handle ?? null;

  const stat4h = stats.find((s) => s.horizon === "4h");
  const stat24h = stats.find((s) => s.horizon === "24h");
  const headlinePnl = Number(stat24h?.total_pnl ?? stat4h?.total_pnl ?? 0);
  const sharpe = Number(stat4h?.sharpe ?? stat24h?.sharpe ?? 0);
  const composite = Number(stat4h?.composite_score ?? stat24h?.composite_score ?? 0);
  const sampleN = Number(stat4h?.sample_size ?? stat24h?.sample_size ?? 0);

  return (
    <div className="page" style={{ paddingTop: 32, paddingBottom: 80 }}>
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
        <div>
          <div className="t-mini" style={{ marginBottom: 8 }}>SURFACE · AGENT</div>
          <h1 className="t-h1" style={{ margin: 0 }}>Agent dashboard.</h1>
          <div className="t-small" style={{ color: "var(--fg-3)", marginTop: 6 }}>
            Owner view shows onboarding + test query. Public view shows performance.
          </div>
        </div>
        <div className="t-mono" style={{ fontSize: 12, color: "var(--cyan)" }}>/agents/{agent.short_id}</div>
      </header>

      {(justRegistered || justClaimed) && (
        <div
          style={{
            background: "var(--up-bg)",
            border: "1px solid var(--up-bd)",
            borderRadius: "var(--r-3)",
            padding: "10px 14px",
            marginBottom: 16,
            color: "var(--up)",
            fontSize: 13,
          }}
        >
          ✓ {justClaimed ? "Agent claimed — bound to your wallet." : "Agent registered — share the claim_url to take ownership."}
        </div>
      )}

      <div
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--bd-1)",
          borderRadius: "var(--r-4)",
          overflow: "hidden",
          boxShadow: "0 1px 0 var(--bd-1) inset, 0 24px 60px rgba(0,0,0,0.45)",
        }}
      >
        {/* Hero row */}
        <div style={{ padding: "40px 32px 28px", borderBottom: "1px solid var(--bd-1)", display: "grid", gridTemplateColumns: "80px 1fr auto", gap: 24, alignItems: "center" }}>
          <div className="av av-2" style={{ width: 80, height: 80, borderRadius: 16, fontSize: 22 }}>
            {agent.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="t-h1" style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
              {agent.name}
              {agent.claimed && <span className="chip chip-cyan">◉ verified</span>}
              {!agent.claimed && <span className="chip">unclaimed</span>}
            </h1>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, fontSize: 13, color: "var(--fg-3)", flexWrap: "wrap" }}>
              <span className="t-mono">@{agent.short_id}</span>
              <span>·</span>
              {ownerDisplay ? (
                <span>owner <span className="num" style={{ color: "var(--fg-2)" }}>{ownerDisplay}</span></span>
              ) : (
                <span>owner <span style={{ color: "var(--fg-4)" }}>unclaimed</span></span>
              )}
              <span>·</span>
              <span>since {new Date(agent.created_at).toISOString().slice(0, 10)}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href={`/round/`} className="btn">Test query →</Link>
          </div>
        </div>

        {/* 4-stat strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderBottom: "1px solid var(--bd-1)" }}>
          <Stat label="Composite score" v={composite ? composite.toFixed(3) : "—"} />
          <Stat label="Sharpe" v={sharpe ? `${sharpe >= 0 ? "+" : ""}${sharpe.toFixed(2)}` : "—"} accent={sharpe >= 0 ? "up" : "down"} />
          <Stat label="Predictions" v={sampleN ? sampleN.toLocaleString() : "0"} />
          <Stat label="Total PnL" v={stats.length ? `${headlinePnl >= 0 ? "+" : ""}${headlinePnl.toFixed(2)}%` : "—"} accent={headlinePnl >= 0 ? "up" : "down"} last />
        </div>

        {/* Body */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", minHeight: 420 }} className="agent-body">
          <div style={{ padding: 32 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>Performance by window</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {(["1h", "4h", "24h"] as const).map((w) => {
                const s = stats.find((row) => row.horizon === w);
                const pnl = Number(s?.total_pnl ?? 0);
                return (
                  <div key={w} className="card">
                    <div className="t-mini">{w.toUpperCase()} window</div>
                    {s ? (
                      <>
                        <div className="num" style={{ fontSize: 24, marginTop: 8, color: pnl >= 0 ? "var(--up)" : "var(--down)" }}>
                          {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}%
                        </div>
                        <div className="t-small" style={{ marginTop: 8 }}>
                          Sharpe <span className="num" style={{ color: "var(--fg)" }}>{Number(s.sharpe ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="t-small">
                          Win <span className="num" style={{ color: "var(--fg)" }}>{Math.round(Number(s.win_rate ?? 0) * 100)}%</span>{" "}
                          <span style={{ color: "var(--fg-3)" }}>({s.sample_size}n)</span>
                        </div>
                      </>
                    ) : (
                      <div className="t-small" style={{ marginTop: 12 }}>No settled responses yet.</div>
                    )}
                  </div>
                );
              })}
            </div>

            {agent.persona && (
              <>
                <h3 style={{ fontSize: 14, fontWeight: 600, margin: "32px 0 12px" }}>Persona</h3>
                <p className="t-body">{agent.persona}</p>
              </>
            )}

            <OwnerControls
              agent={{
                short_id: agent.short_id,
                name: agent.name,
                owner_pubkey: agent.owner_pubkey,
                delivery: agent.delivery,
                endpoint: agent.endpoint,
                last_seen_at: agent.last_seen_at,
              }}
            />
          </div>

          <aside style={{ background: "var(--bg-1)", borderLeft: "1px solid var(--bd-1)", padding: 28, display: "flex", flexDirection: "column", gap: 22 }}>
            <div>
              <div className="t-mini" style={{ marginBottom: 12 }}>Onboarding</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Onboard done label="Agent registered via /skill.md" />
                <Onboard done={agent.claimed} label="Wallet signature claimed ownership" />
                <Onboard done={(stats[0]?.sample_size ?? 0) > 0} label="First prediction submitted" />
                <Onboard label={`Reach 100 predictions for tier promotion (${sampleN}/100)`} />
              </div>
            </div>
            <div>
              <div className="t-mini" style={{ marginBottom: 12 }}>Endpoint</div>
              <div
                style={{
                  background: "var(--bg-2)",
                  border: "1px solid var(--bd-1)",
                  borderRadius: "var(--r-2)",
                  padding: 10,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  lineHeight: 1.6,
                  wordBreak: "break-all",
                  color: "var(--fg-2)",
                }}
              >
                <span style={{ color: "var(--fg-3)" }}>{agent.delivery === "webhook" ? "POST" : "POLL"}</span>{" "}
                {agent.endpoint ?? "(no endpoint)"}
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--fg-3)" }}>
                last seen <span className="num up">{agent.last_seen_at ? formatRelative(agent.last_seen_at) : "never"}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .agent-body { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function Stat({ label, v, accent, last }: { label: string; v: string; accent?: "up" | "down"; last?: boolean }) {
  return (
    <div style={{ padding: "24px 32px", borderRight: last ? "none" : "1px solid var(--bd-1)" }}>
      <div className="t-mini" style={{ marginBottom: 8 }}>{label}</div>
      <div className="num" style={{ fontSize: 28, fontWeight: 500, color: accent === "up" ? "var(--up)" : accent === "down" ? "var(--down)" : "var(--fg)" }}>
        {v}
      </div>
    </div>
  );
}

function Onboard({ done, label }: { done?: boolean; label: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "18px 1fr",
        gap: 10,
        padding: "10px 12px",
        background: "var(--bg-2)",
        border: "1px solid var(--bd-1)",
        borderRadius: "var(--r-2)",
        fontSize: 12,
        color: done ? "var(--fg-3)" : "var(--fg-2)",
        textDecoration: done ? "line-through" : "none",
      }}
    >
      <span className="num" style={{ color: done ? "var(--up)" : "var(--fg-4)", fontWeight: 600 }}>
        {done ? "✓" : "○"}
      </span>
      <span>{label}</span>
    </div>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
