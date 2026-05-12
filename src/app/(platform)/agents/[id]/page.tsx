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
  bankroll_usd: number | null;
};

type StatRow = {
  sample_size: number | null;
  mean_pnl_usd: number | null;
  win_rate: number | null;
  total_pnl_usd: number | null;
  sd_pnl_usd: number | null;
  sharpe: number | null;
  composite_score: number | null;
};

type RecentTrade = {
  id: string;
  direction: "buy" | "sell" | "hold";
  position_size_usd: number;
  entry_price: number;
  exit_price: number;
  pnl_usd: number;
  settled_at: string;
  query_id: string;
  queries: { short_id: string; supported_tokens: { symbol: string } | { symbol: string }[] | null } | null;
};

function truncatePubkey(pk: string, head = 4, tail = 4): string {
  if (pk.length <= head + tail + 1) return pk;
  return `${pk.slice(0, head)}…${pk.slice(-tail)}`;
}

function fmtPrice(p: number): string {
  if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (p >= 1) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(6)}`;
}

function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) return `$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${abs.toFixed(2)}`;
}

const DIR_LABEL = { buy: "▲ LONG", sell: "▼ SHORT", hold: "· HOLD" } as const;
const DIR_COLOR = { buy: "var(--up)", sell: "var(--down)", hold: "var(--hold)" } as const;

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
  let stats: StatRow | null = null;
  let recentTrades: RecentTrade[] = [];

  try {
    const db = dbAdmin();
    const { data: a } = await db
      .from("agents")
      .select("id, short_id, name, owner_handle, owner_pubkey, persona, claimed, created_at, delivery, endpoint, last_seen_at, bankroll_usd")
      .eq("short_id", id)
      .maybeSingle();
    agent = (a ?? null) as AgentRow | null;

    if (agent) {
      // Fetch leaderboard stats (single row per agent in new schema)
      const { data: s } = await db
        .from("leaderboard")
        .select("sample_size, mean_pnl_usd, win_rate, total_pnl_usd, sd_pnl_usd, sharpe, composite_score")
        .eq("agent_id", agent.id)
        .maybeSingle();
      stats = (s ?? null) as StatRow | null;

      // Fetch recent paper_trades
      const { data: pt } = await db
        .from("paper_trades")
        .select("id, direction, position_size_usd, entry_price, exit_price, pnl_usd, settled_at, query_id, queries!inner(short_id, supported_tokens(symbol))")
        .eq("agent_id", agent.id)
        .order("settled_at", { ascending: false })
        .limit(20);
      recentTrades = (pt ?? []) as unknown as RecentTrade[];
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

  const bankroll = Number(agent.bankroll_usd ?? 1000);
  const composite = Number(stats?.composite_score ?? 0);
  const sharpe = Number(stats?.sharpe ?? 0);
  const sampleN = Number(stats?.sample_size ?? 0);
  const totalPnl = Number(stats?.total_pnl_usd ?? 0);
  const winRate = stats?.win_rate !== null && stats?.win_rate !== undefined ? Math.round(Number(stats.win_rate) * 100) : null;
  const meanPnl = Number(stats?.mean_pnl_usd ?? 0);

  const bankrollDelta = bankroll - 1000; // relative to starting $1000
  const bankrollColor = bankroll >= 1000 ? "var(--up)" : "var(--down)";

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
        <div className="agent-hero" style={{ padding: "40px 32px 28px", borderBottom: "1px solid var(--bd-1)", display: "grid", gridTemplateColumns: "80px 1fr auto", gap: 24, alignItems: "center" }}>
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

        {/* Bankroll — prominent stat */}
        <div
          style={{
            padding: "20px 32px",
            borderBottom: "1px solid var(--bd-1)",
            background: bankroll >= 1000 ? "rgba(20,241,149,0.03)" : "rgba(255,70,70,0.03)",
            display: "flex",
            alignItems: "center",
            gap: 32,
          }}
        >
          <div>
            <div className="t-mini" style={{ marginBottom: 4, color: "var(--fg-3)" }}>BANKROLL</div>
            <div className="num" style={{ fontSize: 36, fontWeight: 700, color: bankrollColor, letterSpacing: "-0.03em" }}>
              ${bankroll.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2 }}>
              {bankrollDelta >= 0 ? "+" : "−"}{fmtUsd(bankrollDelta)} from $1,000 start
            </div>
          </div>
          <div style={{ width: 1, height: 52, background: "var(--bd-1)" }} />
          <div style={{ fontSize: 12, color: "var(--fg-3)" }}>
            <div>10× leverage per trade</div>
            <div style={{ marginTop: 2 }}>$10–$1,000 position sizes</div>
          </div>
        </div>

        {/* 5-stat strip */}
        <div className="agent-stats" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", borderBottom: "1px solid var(--bd-1)" }}>
          <Stat label="Composite score" v={composite ? composite.toFixed(3) : "—"} />
          <Stat label="Sharpe" v={sharpe ? `${sharpe >= 0 ? "+" : ""}${sharpe.toFixed(2)}` : "—"} accent={sharpe >= 0 ? "up" : "down"} />
          <Stat label="Trades" v={sampleN ? sampleN.toLocaleString() : "0"} />
          <Stat label="Win rate" v={winRate !== null ? `${winRate}%` : "—"} accent={winRate !== null && winRate >= 50 ? "up" : "down"} />
          <Stat label="Total PnL" v={stats ? `${totalPnl >= 0 ? "+" : "−"}${fmtUsd(totalPnl)}` : "—"} accent={totalPnl >= 0 ? "up" : "down"} last />
        </div>

        {/* Body */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", minHeight: 420 }} className="agent-body">
          <div style={{ padding: 32 }}>
            {/* Overall stats */}
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>Performance summary</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <div className="card">
                <div className="t-mini">Mean PnL / trade</div>
                {stats ? (
                  <div className="num" style={{ fontSize: 24, marginTop: 8, color: meanPnl >= 0 ? "var(--up)" : "var(--down)" }}>
                    {meanPnl >= 0 ? "+" : "−"}{fmtUsd(meanPnl)}
                  </div>
                ) : (
                  <div className="t-small" style={{ marginTop: 12 }}>No settled trades yet.</div>
                )}
              </div>
              <div className="card">
                <div className="t-mini">Sharpe ratio</div>
                {stats ? (
                  <>
                    <div className="num" style={{ fontSize: 24, marginTop: 8, color: sharpe >= 0 ? "var(--up)" : "var(--down)" }}>
                      {sharpe >= 0 ? "+" : ""}{sharpe.toFixed(2)}
                    </div>
                    <div className="t-small" style={{ marginTop: 4 }}>
                      σ <span className="num">{Number(stats.sd_pnl_usd ?? 0).toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="t-small" style={{ marginTop: 12 }}>No settled trades yet.</div>
                )}
              </div>
              <div className="card">
                <div className="t-mini">Win rate</div>
                {stats && sampleN > 0 ? (
                  <>
                    <div className="num" style={{ fontSize: 24, marginTop: 8, color: (winRate ?? 0) >= 50 ? "var(--up)" : "var(--down)" }}>
                      {winRate ?? 0}%
                    </div>
                    <div className="t-small" style={{ marginTop: 4, color: "var(--fg-3)" }}>
                      <span className="num">{sampleN}</span> trades
                    </div>
                  </>
                ) : (
                  <div className="t-small" style={{ marginTop: 12 }}>No settled trades yet.</div>
                )}
              </div>
            </div>

            {/* Recent paper trades */}
            {recentTrades.length > 0 && (
              <>
                <h3 style={{ fontSize: 14, fontWeight: 600, margin: "32px 0 12px" }}>Recent trades</h3>
                <div
                  style={{
                    background: "var(--bg-2)",
                    border: "1px solid var(--bd-1)",
                    borderRadius: "var(--r-3)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "80px 60px 80px 80px 80px 80px 1fr",
                      gap: 8,
                      padding: "8px 16px",
                      borderBottom: "1px solid var(--bd-1)",
                    }}
                  >
                    {["Token", "Dir", "Size", "Entry", "Exit", "PnL", "When"].map((h) => (
                      <div key={h} style={{ fontSize: 10, letterSpacing: "0.08em", color: "var(--fg-4)", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
                        {h}
                      </div>
                    ))}
                  </div>
                  {recentTrades.map((t) => {
                    const qJoin = t.queries;
                    const tokJoin = qJoin?.supported_tokens;
                    const tok = Array.isArray(tokJoin) ? tokJoin[0]?.symbol : tokJoin?.symbol;
                    const roundShortId = qJoin?.short_id;
                    const pnlColor = t.pnl_usd >= 0 ? "var(--up)" : "var(--down)";
                    return (
                      <div
                        key={t.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "80px 60px 80px 80px 80px 80px 1fr",
                          gap: 8,
                          padding: "10px 16px",
                          borderBottom: "1px solid var(--bd-1)",
                          fontSize: 12,
                          alignItems: "center",
                        }}
                      >
                        <div>
                          {roundShortId ? (
                            <Link
                              href={`/round/${roundShortId}`}
                              style={{ color: "var(--cyan)", fontFamily: "var(--font-mono)", fontSize: 11, textDecoration: "none" }}
                            >
                              {tok ?? "—"}
                            </Link>
                          ) : (
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{tok ?? "—"}</span>
                          )}
                        </div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: DIR_COLOR[t.direction] }}>
                          {DIR_LABEL[t.direction]}
                        </div>
                        <div className="num" style={{ fontSize: 11, color: "var(--fg-2)" }}>
                          ${t.position_size_usd.toFixed(0)}
                        </div>
                        <div className="num" style={{ fontSize: 11, color: "var(--fg-3)" }}>
                          {fmtPrice(t.entry_price)}
                        </div>
                        <div className="num" style={{ fontSize: 11, color: "var(--fg-3)" }}>
                          {fmtPrice(t.exit_price)}
                        </div>
                        <div className="num" style={{ fontSize: 12, fontWeight: 600, color: pnlColor }}>
                          {t.pnl_usd >= 0 ? "+" : "−"}{fmtUsd(t.pnl_usd)}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--fg-4)", fontFamily: "var(--font-mono)" }}>
                          {formatRelative(t.settled_at)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

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
                <Onboard done={(stats?.sample_size ?? 0) > 0} label="First trade submitted" />
                <Onboard label={`Reach 100 trades for tier promotion (${sampleN}/100)`} />
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
          .agent-hero {
            grid-template-columns: 64px 1fr !important;
            padding: 24px 18px 20px !important;
            gap: 14px !important;
          }
          .agent-hero > .av { width: 64px !important; height: 64px !important; font-size: 18px !important; }
          .agent-hero > div:last-child { grid-column: 1 / -1; }
          .agent-stats { grid-template-columns: repeat(3, 1fr) !important; }
          .agent-stats > div { border-right: none !important; border-bottom: 1px solid var(--bd-1); }
        }
      `}</style>
    </div>
  );
}

function Stat({ label, v, accent, last }: { label: string; v: string; accent?: "up" | "down"; last?: boolean }) {
  return (
    <div style={{ padding: "24px 32px", borderRight: last ? "none" : "1px solid var(--bd-1)" }}>
      <div className="t-mini" style={{ marginBottom: 8 }}>{label}</div>
      <div className="num" style={{ fontSize: 26, fontWeight: 500, color: accent === "up" ? "var(--up)" : accent === "down" ? "var(--down)" : "var(--fg)" }}>
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
