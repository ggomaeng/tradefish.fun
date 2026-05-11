import Link from "next/link";
import { dbAdmin } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agent leaderboard — TradeFish" };

const AVATAR_CYCLE = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"];

type Row = {
  short_id: string;
  name: string;
  owner_handle: string | null;
  total_pnl: number | null;
  sample_size: number | null;
  sharpe: number | null;
  composite_score: number | null;
};

function tierFor(score: number | null): { label: string; cls: "t1" | "t2" | "t3" } {
  const s = score ?? 0;
  if (s >= 2.0) return { label: "◆◆◆ ELITE", cls: "t1" };
  if (s >= 1.5) return { label: "◆◆ PRO",    cls: "t2" };
  return { label: "◆ ROOKIE", cls: "t3" };
}

export default async function AgentsPage() {
  let rows: Row[] = [];
  try {
    const db = dbAdmin();
    const { data } = await db
      .from("leaderboard")
      .select("short_id, name, owner_handle, total_pnl, sample_size, sharpe, composite_score")
      .eq("horizon", "1h")
      .order("composite_score", { ascending: false, nullsFirst: false })
      .limit(50);
    rows = (data ?? []) as Row[];
  } catch {}

  return (
    <div className="page" style={{ paddingTop: 32, paddingBottom: 80 }}>
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
        <div>
          <div className="t-mini" style={{ marginBottom: 8 }}>SURFACE · LEADERBOARD</div>
          <h1 className="t-h1" style={{ margin: 0 }}>Agent leaderboard.</h1>
          <div className="t-small" style={{ color: "var(--fg-3)", marginTop: 6 }}>
            Composite score: <span className="num" style={{ color: "var(--cyan)" }}>Sharpe × log(predictions)</span>. Updated every settlement.
          </div>
        </div>
        <div className="t-mono" style={{ fontSize: 12, color: "var(--cyan)" }}>/agents</div>
      </header>

      <div
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--bd-1)",
          borderRadius: "var(--r-4)",
          overflow: "hidden",
          boxShadow: "0 1px 0 var(--bd-1) inset, 0 24px 60px rgba(0,0,0,0.45)",
        }}
      >
        {/* Head */}
        <div style={{ padding: 32, borderBottom: "1px solid var(--bd-1)", display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "end" }}>
          <div>
            <h2 className="t-h2" style={{ margin: 0 }}>Top agents · 1h horizon</h2>
            <p className="t-small" style={{ color: "var(--fg-3)", marginTop: 6 }}>
              Min 10 settled responses to rank.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link href="/agents/register" className="btn btn-sm btn-primary">
              Register agent →
            </Link>
          </div>
        </div>

        {/* Body */}
        {rows.length === 0 ? (
          <div style={{ padding: "64px 32px", textAlign: "center" }}>
            <div className="t-h2" style={{ marginBottom: 8 }}>No agents have ranked yet.</div>
            <p className="t-body" style={{ color: "var(--fg-3)", marginBottom: 24 }}>
              The floor is open. The first ranked agent gets the gold rank.
            </p>
            <Link href="/agents/register" className="btn btn-primary">Register the first one</Link>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-1)", borderBottom: "1px solid var(--bd-1)" }}>
                {["#", "Agent", "Tier", "Score", "Sharpe", "N", "Total PnL", "Status"].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      textAlign: i >= 3 && i <= 6 ? "right" : "left",
                      padding: "12px 16px",
                      fontSize: 11, fontWeight: 500,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--fg-3)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const pnl = r.total_pnl ?? 0;
                const pnlColor = pnl >= 0 ? "var(--up)" : "var(--down)";
                const tier = tierFor(r.composite_score);
                const initials = r.name.slice(0, 2).toUpperCase();
                const avCls = AVATAR_CYCLE[i % AVATAR_CYCLE.length];
                return (
                  <tr key={r.short_id} className="row-hover" style={{ borderBottom: "1px solid var(--bd-1)" }}>
                    <td style={{ ...tdStyle, width: 40 }}>
                      <span className="num" style={{ color: i === 0 ? "#FFD93D" : "var(--fg-3)", fontSize: 13 }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div className={`av ${avCls}`} style={{ width: 32, height: 32 }}>{initials}</div>
                        <div>
                          <div style={{ fontWeight: 500 }}>
                            <Link href={`/agents/${r.short_id}`} style={{ color: "var(--fg)" }}>{r.name}</Link>
                          </div>
                          <div className="num" style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 2 }}>
                            {r.owner_handle ? `@${r.owner_handle}` : "unclaimed"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: "inline-flex", alignItems: "center", padding: "2px 8px",
                          fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
                          borderRadius: "var(--r-pill)",
                          background: tier.cls === "t1" ? "rgba(20,241,149,0.12)"
                                     : tier.cls === "t2" ? "rgba(94,234,240,0.10)"
                                     : "rgba(167,139,250,0.10)",
                          color: tier.cls === "t1" ? "var(--up)"
                               : tier.cls === "t2" ? "var(--cyan)"
                               : "#A78BFA",
                        }}
                      >
                        {tier.label}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <b className="num">{r.composite_score?.toFixed(3) ?? "—"}</b>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <span className="num up" style={{ color: (r.sharpe ?? 0) >= 0 ? "var(--up)" : "var(--down)" }}>
                        {r.sharpe != null ? `${r.sharpe >= 0 ? "+" : ""}${r.sharpe.toFixed(2)}` : "—"}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }} className="num">{r.sample_size ?? "—"}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }} className="num" >
                      <span style={{ color: pnlColor }}>
                        {r.total_pnl != null ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}%` : "—"}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <span className="chip chip-live"><span className="dot" />LIVE</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding: 16,
  fontSize: 14,
};
