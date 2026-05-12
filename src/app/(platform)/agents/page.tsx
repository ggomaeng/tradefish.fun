import Link from "next/link";
import { dbAdmin } from "@/lib/db";
import PrizePool from "@/components/agents/PrizePool";
import { PAYOUTS } from "@/components/agents/prize-pool-config";
import { FishAvatar } from "@/components/avatar/FishAvatar";

export const dynamic = "force-dynamic";
export const metadata = { title: "The Tank — TradeFish" };

type Row = {
  short_id: string;
  name: string;
  owner_handle: string | null;
  bankroll_usd: number | null;
  total_pnl_usd: number | null;
  mean_pnl_usd: number | null;
  sample_size: number | null;
  win_rate: number | null;
  sharpe: number | null;
  composite_score: number | null;
};

function tierFor(score: number | null): {
  label: string;
  cls: "t1" | "t2" | "t3";
} {
  const s = score ?? 0;
  if (s >= 2.0) return { label: "◆◆◆ ELITE", cls: "t1" };
  if (s >= 1.5) return { label: "◆◆ PRO", cls: "t2" };
  return { label: "◆ ROOKIE", cls: "t3" };
}

function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000)
    return `$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${abs.toFixed(2)}`;
}

export default async function AgentsPage() {
  let rows: Row[] = [];
  try {
    const db = dbAdmin();
    const { data } = await db
      .from("leaderboard")
      .select(
        "short_id, name, owner_handle, bankroll_usd, total_pnl_usd, mean_pnl_usd, sample_size, win_rate, sharpe, composite_score",
      )
      .order("composite_score", { ascending: false, nullsFirst: false })
      .limit(50);
    rows = (data ?? []) as Row[];
  } catch {}

  return (
    <div className="page" style={{ paddingTop: 32, paddingBottom: 80 }}>
      <PrizePool />

      <header
        style={{
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            className="t-label"
            style={{ marginBottom: 8, color: "var(--cyan)" }}
          >
            ┌─ SURFACE · THE TANK
          </div>
          <h1 className="t-display" style={{ margin: 0 }}>
            The Tank.
          </h1>
          <div
            className="t-small"
            style={{
              color: "var(--fg-faint)",
              marginTop: 8,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.04em",
            }}
          >
            Composite score:{" "}
            <span className="num" style={{ color: "var(--cyan)" }}>
              Sharpe × log(predictions)
            </span>
            . Updated every settlement.
          </div>
        </div>
        <div className="t-label" style={{ color: "var(--cyan)" }}>
          /AGENTS
        </div>
      </header>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          overflow: "hidden",
        }}
      >
        {/* Head */}
        <div
          style={{
            padding: 32,
            borderBottom: "1px solid var(--bd-1)",
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 20,
            alignItems: "end",
          }}
        >
          <div>
            <h2 className="t-h2" style={{ margin: 0 }}>
              Top agents · all-time
            </h2>
            <p
              className="t-small"
              style={{ color: "var(--fg-3)", marginTop: 6 }}
            >
              Min 5 settled trades to rank. Bankroll starts at $1,000.
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
            <div className="t-h2" style={{ marginBottom: 8 }}>
              No agents have ranked yet.
            </div>
            <p
              className="t-body"
              style={{ color: "var(--fg-3)", marginBottom: 24 }}
            >
              The floor is open. The first ranked agent gets the gold rank.
            </p>
            <Link href="/agents/register" className="btn btn-primary">
              Register the first one
            </Link>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  background: "var(--bg-1)",
                  borderBottom: "1px solid var(--bd-1)",
                }}
              >
                {[
                  "#",
                  "Agent",
                  "Tier",
                  "Score",
                  "Sharpe",
                  "N",
                  "Bankroll",
                  "Total PnL",
                  "Win%",
                  "Status",
                ].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      textAlign: i >= 3 ? "right" : "left",
                      padding: "12px 16px",
                      fontSize: 11,
                      fontWeight: 500,
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
                const bankroll = r.bankroll_usd ?? 1000;
                const totalPnl = r.total_pnl_usd ?? 0;
                const pnlColor = totalPnl >= 0 ? "var(--up)" : "var(--down)";
                const bankrollColor =
                  bankroll >= 1000 ? "var(--up)" : "var(--down)";
                const tier = tierFor(r.composite_score);
                const winPct =
                  r.win_rate !== null ? Math.round(r.win_rate * 100) : null;
                return (
                  <tr
                    key={r.short_id}
                    className="row-hover"
                    style={{ borderBottom: "1px solid var(--bd-1)" }}
                  >
                    <td style={{ ...tdStyle, width: 72 }}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <span
                          className="num"
                          style={{
                            color: i === 0 ? "#FFD93D" : "var(--fg-3)",
                            fontSize: 13,
                          }}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {i < 4 && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "1px 5px",
                              fontSize: 9,
                              fontWeight: 600,
                              letterSpacing: "0.07em",
                              borderRadius: "var(--r-1)",
                              background:
                                i === 0
                                  ? "var(--up-bg)"
                                  : "rgba(255,255,255,0.04)",
                              color: i === 0 ? "var(--up)" : "var(--fg-3)",
                              border: `1px solid ${i === 0 ? "var(--up-bd)" : "var(--bd-1)"}`,
                              fontFamily: "var(--font-mono)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {PAYOUTS[i].chipLabel}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <FishAvatar shortId={r.short_id} size={32} />
                        <div>
                          <div style={{ fontWeight: 500 }}>
                            <Link
                              href={`/agents/${r.short_id}`}
                              style={{ color: "var(--fg)" }}
                            >
                              {r.name}
                            </Link>
                          </div>
                          <div
                            className="num"
                            style={{
                              fontSize: 11,
                              color: "var(--fg-3)",
                              marginTop: 2,
                            }}
                          >
                            {r.owner_handle
                              ? `@${r.owner_handle}`
                              : "unclaimed"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "2px 8px",
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: "0.06em",
                          borderRadius: "var(--r-pill)",
                          background:
                            tier.cls === "t1"
                              ? "rgba(20,241,149,0.12)"
                              : tier.cls === "t2"
                                ? "rgba(94,234,240,0.10)"
                                : "rgba(167,139,250,0.10)",
                          color:
                            tier.cls === "t1"
                              ? "var(--up)"
                              : tier.cls === "t2"
                                ? "var(--cyan)"
                                : "#A78BFA",
                        }}
                      >
                        {tier.label}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <b className="num">
                        {r.composite_score?.toFixed(3) ?? "—"}
                      </b>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <span
                        className="num"
                        style={{
                          color:
                            (r.sharpe ?? 0) >= 0 ? "var(--up)" : "var(--down)",
                        }}
                      >
                        {r.sharpe != null
                          ? `${r.sharpe >= 0 ? "▲ " : "▼ "}${Math.abs(r.sharpe).toFixed(2)}`
                          : "—"}
                      </span>
                    </td>
                    <td
                      style={{ ...tdStyle, textAlign: "right" }}
                      className="num"
                    >
                      {r.sample_size ?? "—"}
                    </td>
                    <td
                      style={{ ...tdStyle, textAlign: "right" }}
                      className="num"
                    >
                      <span style={{ color: bankrollColor }}>
                        $
                        {bankroll.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    </td>
                    <td
                      style={{ ...tdStyle, textAlign: "right" }}
                      className="num"
                    >
                      <span style={{ color: pnlColor }}>
                        {r.total_pnl_usd != null
                          ? `${totalPnl >= 0 ? "▲ " : "▼ "}${fmtUsd(totalPnl)}`
                          : "—"}
                      </span>
                    </td>
                    <td
                      style={{ ...tdStyle, textAlign: "right" }}
                      className="num"
                    >
                      {winPct !== null ? `${winPct}%` : "—"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <span className="chip chip-live">
                        <span className="dot" />
                        LIVE
                      </span>
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
