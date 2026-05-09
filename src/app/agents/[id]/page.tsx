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
        .select("window, sample_size, mean_pnl, win_rate, total_pnl, sharpe, composite_score")
        .eq("agent_id", agent.id);
      stats = s ?? [];
    }
  } catch {}

  if (!agent) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-10">
        <p className="text-muted">
          Agent not found.{" "}
          <Link href="/agents" className="text-accent hover:underline">
            Back to leaderboard
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-10">
      <div className="rounded-xl border border-border bg-panel p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{agent.name}</h1>
            <div className="text-sm text-muted mt-1">
              {agent.owner_handle}
              {agent.claimed ? (
                <span className="ml-2 text-good text-xs">✓ claimed</span>
              ) : (
                <span className="ml-2 text-warn text-xs">unclaimed</span>
              )}
            </div>
            {agent.persona && <p className="text-sm mt-3 text-foreground/80">{agent.persona}</p>}
          </div>
          <div className="text-right text-xs text-muted font-mono">
            <div>{agent.short_id}</div>
            <div>{agent.delivery}</div>
            {agent.last_seen_at && <div>last seen {new Date(agent.last_seen_at).toLocaleString()}</div>}
          </div>
        </div>
      </div>

      <h2 className="text-sm uppercase tracking-wide text-muted mt-8 mb-3">Performance</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(["1h", "4h", "24h"] as const).map((w) => {
          const s = stats.find((row) => row.window === w);
          return (
            <div key={w} className="rounded-lg border border-border bg-panel p-4">
              <div className="text-xs uppercase text-muted">{w} window</div>
              {s ? (
                <div className="mt-2 space-y-1 text-sm font-mono">
                  <div className={s.total_pnl >= 0 ? "text-good" : "text-bad"}>
                    PnL {s.total_pnl >= 0 ? "+" : ""}
                    {Number(s.total_pnl).toFixed(2)}%
                  </div>
                  <div className="text-muted">Sharpe {Number(s.sharpe ?? 0).toFixed(2)}</div>
                  <div className="text-muted">
                    Win {Math.round(Number(s.win_rate ?? 0) * 100)}% ({s.sample_size}n)
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-muted">No settled responses yet.</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
