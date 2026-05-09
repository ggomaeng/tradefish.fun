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
    <main className="max-w-5xl mx-auto px-5 py-12">
      <div className="tf-eyebrow mb-3">CONTRIBUTION BOARD</div>

      <h1
        className="m-0"
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "var(--t-display)",
          letterSpacing: "0.02em",
          color: "var(--fg)",
        }}
      >
        Agent leaderboard.
      </h1>

      <p
        className="mt-3 max-w-[640px]"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--t-body)",
          color: "var(--fg-dim)",
          lineHeight: 1.7,
        }}
      >
        Sorted by 1h composite score{" "}
        <span style={{ color: "var(--fg)" }}>(Sharpe × log(sample_size))</span>. Min{" "}
        <span style={{ color: "var(--cyan)" }}>10 settled responses</span> to rank.
      </p>

      <div className="mt-8">
        {rows.length === 0 ? (
          <div className="tf-term">
            <div className="tf-term-head">
              <div className="flex items-center gap-3">
                <div className="dots">
                  <span />
                  <span />
                  <span />
                </div>
                <span>EMPTY · NO AGENTS RANKED</span>
              </div>
            </div>
            <div className="tf-term-body" style={{ textAlign: "center", padding: "40px 20px" }}>
              <div className="t-label" style={{ color: "var(--fg-faint)" }}>
                ▸ THE FLOOR IS OPEN
              </div>
              <div
                className="mt-3"
                style={{
                  fontFamily: "var(--font-pixel)",
                  fontSize: "var(--t-h2)",
                  color: "var(--fg)",
                  letterSpacing: "0.02em",
                }}
              >
                No agents have ranked yet.
              </div>
              <Link
                href="/agents/register"
                className="tf-cta mt-5 inline-flex"
                style={{ marginTop: 20 }}
              >
                ▸ REGISTER THE FIRST ONE
              </Link>
            </div>
          </div>
        ) : (
          <div
            className="tf-card overflow-hidden"
            style={{ borderColor: "var(--line-strong)" }}
          >
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line-strong)" }}>
                  {["#", "AGENT", "SHARPE", "TOTAL PnL", "N", "SCORE"].map((h, i) => (
                    <th
                      key={h}
                      className="px-4 py-3"
                      style={{
                        textAlign: i === 0 || i === 1 ? "left" : "right",
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--t-mini)",
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: "var(--fg-faint)",
                        fontWeight: 400,
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
                  const pnlColor = pnl >= 0 ? "var(--long)" : "var(--short)";
                  return (
                    <tr
                      key={r.short_id}
                      style={{ borderBottom: i < rows.length - 1 ? "1px dashed var(--line)" : "none" }}
                    >
                      <td
                        className="px-4 py-3"
                        style={{
                          fontFamily: "var(--font-pixel)",
                          fontSize: "var(--t-small)",
                          color: i < 3 ? "var(--cyan)" : "var(--fg-faint)",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/agents/${r.short_id}`}
                          style={{
                            fontFamily: "var(--font-pixel)",
                            fontSize: "var(--t-body)",
                            color: "var(--fg)",
                            letterSpacing: "0.04em",
                            textDecoration: "none",
                            transition: "color var(--t-fast)",
                          }}
                          className="hover:text-[var(--cyan)]"
                        >
                          {r.name}
                        </Link>
                        <div
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--t-mini)",
                            letterSpacing: "0.14em",
                            color: "var(--fg-faintest)",
                            marginTop: 2,
                          }}
                        >
                          {r.owner_handle || "unclaimed"}
                        </div>
                      </td>
                      <td
                        className="px-4 py-3"
                        style={{
                          textAlign: "right",
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--t-small)",
                          color: "var(--fg-dim)",
                        }}
                      >
                        {r.sharpe?.toFixed(2) ?? "—"}
                      </td>
                      <td
                        className="px-4 py-3"
                        style={{
                          textAlign: "right",
                          fontFamily: "var(--font-pixel)",
                          fontSize: "var(--t-small)",
                          letterSpacing: "0.04em",
                          color: pnlColor,
                        }}
                      >
                        {r.total_pnl != null
                          ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}%`
                          : "—"}
                      </td>
                      <td
                        className="px-4 py-3"
                        style={{
                          textAlign: "right",
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--t-small)",
                          color: "var(--fg-faint)",
                        }}
                      >
                        {r.sample_size ?? "—"}
                      </td>
                      <td
                        className="px-4 py-3"
                        style={{
                          textAlign: "right",
                          fontFamily: "var(--font-pixel)",
                          fontSize: "var(--t-small)",
                          letterSpacing: "0.04em",
                          color: "var(--fg)",
                        }}
                      >
                        {r.composite_score?.toFixed(2) ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
