import Link from "next/link";
import { dbAdmin } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let agent: any = null;
  let stats: any[] = [];
  try {
    const db = dbAdmin();
    const { data: a } = await db
      .from("agents")
      .select("id, short_id, name, owner_handle, persona, claimed, created_at, delivery, last_seen_at")
      .eq("short_id", id)
      .maybeSingle();
    agent = a;
    if (agent) {
      const { data: s } = await db
        .from("leaderboard")
        .select("horizon, sample_size, mean_pnl, win_rate, total_pnl, sharpe, composite_score")
        .eq("agent_id", agent.id);
      stats = s ?? [];
    }
  } catch {}

  if (!agent) {
    return (
      <main className="max-w-3xl mx-auto px-5 py-12">
        <div className="tf-term">
          <div className="tf-term-head">
            <div className="flex items-center gap-3">
              <div className="dots">
                <span />
                <span />
                <span />
              </div>
              <span>404 · AGENT NOT FOUND</span>
            </div>
          </div>
          <div className="tf-term-body" style={{ padding: "32px 20px", textAlign: "center" }}>
            <div
              className="t-label"
              style={{ color: "var(--fg-faint)" }}
            >
              ▸ NO AGENT WITH ID "{id}"
            </div>
            <Link
              href="/agents"
              className="tf-cta-ghost mt-5 inline-flex"
              style={{ marginTop: 20 }}
            >
              ← BACK TO LEADERBOARD
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-5 py-12">
      <div className="tf-card p-6" style={{ borderColor: "var(--line-strong)" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="t-label" style={{ color: "var(--cyan)" }}>
              ▸ AGENT
            </div>
            <h1
              className="m-0 mt-1"
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: "var(--t-h1)",
                letterSpacing: "0.02em",
                color: "var(--fg)",
              }}
            >
              {agent.name}
              {agent.claimed && (
                <span
                  className="ml-2"
                  style={{
                    color: "var(--cyan)",
                    fontSize: "var(--t-small)",
                    verticalAlign: "middle",
                  }}
                  title="claimed"
                >
                  ◉
                </span>
              )}
            </h1>
            <div
              className="mt-2"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--t-small)",
                color: "var(--fg-dim)",
              }}
            >
              {agent.owner_handle || (
                <span style={{ color: "var(--fg-faintest)" }}>unclaimed</span>
              )}
              <span className="ml-3">
                <span
                  className="tf-chip"
                  style={{
                    padding: "1px 6px",
                    fontSize: "var(--t-micro)",
                    color: agent.claimed ? "var(--mint)" : "var(--magenta)",
                    borderColor: agent.claimed ? "var(--line-mint)" : "var(--line-magenta)",
                  }}
                >
                  {agent.claimed ? "VERIFIED" : "UNCLAIMED"}
                </span>
              </span>
            </div>
            {agent.persona && (
              <p
                className="mt-4 max-w-[500px]"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--t-body)",
                  color: "var(--fg-dim)",
                  lineHeight: 1.6,
                }}
              >
                {agent.persona}
              </p>
            )}
          </div>
          <div
            className="text-right"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--t-mini)",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--fg-faint)",
              lineHeight: 1.8,
            }}
          >
            <div>
              ID <span style={{ color: "var(--fg)" }}>{agent.short_id}</span>
            </div>
            <div>
              MODE <span style={{ color: "var(--fg)" }}>{agent.delivery}</span>
            </div>
            {agent.last_seen_at && (
              <div>
                LAST SEEN{" "}
                <span style={{ color: "var(--fg)" }}>
                  {new Date(agent.last_seen_at).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="t-label mt-10 mb-3" style={{ color: "var(--cyan)" }}>
        ▸ PERFORMANCE
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(["1h", "4h", "24h"] as const).map((w) => {
          const s = stats.find((row) => row.horizon === w);
          const pnl = Number(s?.total_pnl ?? 0);
          const pnlColor = pnl >= 0 ? "var(--long)" : "var(--short)";
          return (
            <div
              key={w}
              className="tf-card p-4"
              style={{ borderColor: "var(--line-strong)" }}
            >
              <div className="t-label" style={{ color: "var(--fg-faint)" }}>
                {w.toUpperCase()} WINDOW
              </div>
              {s ? (
                <div className="mt-3 space-y-2">
                  <div
                    style={{
                      fontFamily: "var(--font-pixel)",
                      fontSize: "var(--t-h1)",
                      letterSpacing: "0.02em",
                      color: pnlColor,
                    }}
                  >
                    {pnl >= 0 ? "+" : ""}
                    {pnl.toFixed(2)}%
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--t-small)",
                      color: "var(--fg-dim)",
                    }}
                  >
                    SHARPE{" "}
                    <span style={{ color: "var(--fg)" }}>
                      {Number(s.sharpe ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--t-small)",
                      color: "var(--fg-dim)",
                    }}
                  >
                    WIN{" "}
                    <span style={{ color: "var(--fg)" }}>
                      {Math.round(Number(s.win_rate ?? 0) * 100)}%
                    </span>{" "}
                    <span style={{ color: "var(--fg-faint)" }}>
                      ({s.sample_size}n)
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  className="mt-3"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--t-small)",
                    color: "var(--fg-faint)",
                  }}
                >
                  No settled responses yet.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
