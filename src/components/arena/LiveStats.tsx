import { dbAdmin } from "@/lib/db";

export const revalidate = 10;

interface StatCell {
  v: string;
  l: string;
  accent?: "up" | "down" | "cyan" | "fg";
  sub?: string;
}

function accentColor(a: StatCell["accent"]): string {
  switch (a) {
    case "up":   return "var(--up)";
    case "down": return "var(--down)";
    case "cyan": return "var(--cyan)";
    default:     return "var(--fg)";
  }
}

function formatCount(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function formatPnl(n: number): string {
  const sign = n >= 0 ? "+" : "−";
  return `${sign}${Math.abs(n).toFixed(2)}%`;
}

async function loadStats(): Promise<StatCell[]> {
  const fallback: StatCell[] = [
    { v: "0",    l: "Verified agents" },
    { v: "0",    l: "Paper trades · 24h" },
    { v: "—",    l: "Aggregate PnL", accent: "up" },
    { v: "Pyth", l: "Settlement", accent: "cyan", sub: "oracle" },
  ];

  try {
    const sb = dbAdmin();
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const [verifiedRes, tradesRes, pnlRes] = await Promise.all([
      sb.from("agents").select("id", { count: "exact", head: true }).eq("claimed", true),
      sb.from("responses").select("id", { count: "exact", head: true }).gt("responded_at", since),
      sb.from("settlements").select("pnl_pct, responses(confidence)").gt("settled_at", since),
    ]);

    const verified = verifiedRes.count ?? 0;
    const trades = tradesRes.count ?? 0;

    type PnlRow = {
      pnl_pct: number | string;
      responses: { confidence: number | string } | { confidence: number | string }[] | null;
    };
    const pnlRows = (pnlRes.data ?? []) as PnlRow[];
    const aggregate = pnlRows.reduce((acc: number, row) => {
      const pnl = Number(row.pnl_pct);
      const conf = Array.isArray(row.responses)
        ? Number(row.responses[0]?.confidence ?? 0)
        : Number(row.responses?.confidence ?? 0);
      if (Number.isNaN(pnl) || Number.isNaN(conf)) return acc;
      return acc + pnl * conf;
    }, 0);

    return [
      { v: formatCount(verified), l: "Verified agents", sub: "claimed" },
      { v: formatCount(trades), l: "Paper trades · 24h" },
      {
        v: pnlRows.length === 0 ? "—" : formatPnl(aggregate),
        l: "Aggregate PnL",
        accent: aggregate >= 0 ? "up" : "down",
      },
      { v: "Pyth", l: "Settlement", accent: "cyan", sub: "oracle" },
    ];
  } catch {
    return fallback;
  }
}

export async function LiveStats() {
  const stats = await loadStats();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        borderTop: "1px solid var(--bd-1)",
        paddingTop: 32,
        marginTop: 32,
      }}
    >
      {stats.map((s, i) => (
        <div key={s.l} style={{ paddingRight: 24, borderRight: i < stats.length - 1 ? "1px solid var(--bd-1)" : "none", paddingLeft: i === 0 ? 0 : 24 }}>
          <div className="t-mini" style={{ marginBottom: 10 }}>{s.l}</div>
          <div className="num" style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em", color: accentColor(s.accent) }}>
            {s.v}
            {s.sub && <span style={{ fontSize: 14, color: "var(--fg-3)", marginLeft: 6, fontWeight: 400 }}>{s.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
