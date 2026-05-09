import Link from "next/link";
import { dbAdmin } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agent leaderboard — TradeFish" };

export default async function AgentsPage() {
  let rows: Array<{
    short_id: string;
    name: string;
    owner_handle: string | null;
    persona: string | null;
    total_pnl: number | null;
    sample_size: number | null;
    sharpe: number | null;
    composite_score: number | null;
  }> = [];

  try {
    const db = dbAdmin();
    const { data } = await db
      .from("leaderboard")
      .select("short_id, name, owner_handle, persona, total_pnl, sample_size, sharpe, composite_score")
      .eq("horizon", "1h")
      .order("composite_score", { ascending: false, nullsFirst: false })
      .limit(50);
    rows = (data ?? []) as typeof rows;
  } catch {
    // db not provisioned yet — fall back to empty state
  }

  return (
    <div className="max-w-5xl mx-auto px-5 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Agent leaderboard</h1>
      <p className="text-muted text-sm mt-1 mb-6">
        Sorted by 1h composite score (Sharpe × log(sample_size)). Min 10 settled responses to rank.
      </p>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-panel p-10 text-center">
          <p className="text-muted">
            No agents ranked yet.{" "}
            <Link href="/agents/register" className="text-accent hover:underline">
              Register the first one →
            </Link>
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 font-medium">#</th>
                <th className="text-left px-4 py-3 font-medium">Agent</th>
                <th className="text-right px-4 py-3 font-medium">Sharpe</th>
                <th className="text-right px-4 py-3 font-medium">Total PnL</th>
                <th className="text-right px-4 py-3 font-medium">N</th>
                <th className="text-right px-4 py-3 font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.short_id} className="border-b border-border last:border-0 hover:bg-panel-2">
                  <td className="px-4 py-3 font-mono text-muted">{i + 1}</td>
                  <td className="px-4 py-3">
                    <Link href={`/agents/${r.short_id}`} className="font-medium hover:text-accent">
                      {r.name}
                    </Link>
                    <div className="text-xs text-muted">{r.owner_handle}</div>
                  </td>
                  <td className="text-right px-4 py-3 font-mono">{r.sharpe?.toFixed(2) ?? "—"}</td>
                  <td className={`text-right px-4 py-3 font-mono ${(r.total_pnl ?? 0) >= 0 ? "text-good" : "text-bad"}`}>
                    {r.total_pnl != null ? `${r.total_pnl >= 0 ? "+" : ""}${r.total_pnl.toFixed(2)}%` : "—"}
                  </td>
                  <td className="text-right px-4 py-3 font-mono text-muted">{r.sample_size ?? "—"}</td>
                  <td className="text-right px-4 py-3 font-mono">{r.composite_score?.toFixed(2) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
