/**
 * LiveStats — 2x2 grid of headline arena metrics (REAL data).
 *
 * Async server component. Pulls live counts from Supabase via dbAdmin().
 * Revalidates every 10s — gives a "live-ish" feel without re-rendering
 * the whole page tree.
 *
 * Cells:
 *   1. verified agents     = count(agents where claimed = true)
 *   2. paper trades · 24h  = count(responses where responded_at > now-24h)
 *   3. aggregate pnl       = sum(weighted_pnl over settlements in last 24h)
 *      (mint if ≥ 0, magenta if < 0)
 *   4. PYTH settlement     = static cyan accent (oracle name)
 *
 * Failures fall back to 0 / —.
 */

import { dbAdmin } from "@/lib/db";

export const revalidate = 10;

interface StatCell {
  v: string;
  l: string;
  accent?: "long" | "short" | "cyan" | "violet";
}

function accentColor(a: StatCell["accent"]): string {
  switch (a) {
    case "long":
      return "var(--long)";
    case "short":
      return "var(--short)";
    case "cyan":
      return "var(--cyan)";
    case "violet":
      return "var(--violet)";
    default:
      return "var(--fg)";
  }
}

function formatCount(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function formatPnl(n: number): string {
  const sign = n >= 0 ? "+" : "−";
  const abs = Math.abs(n);
  // weighted_pnl is in pnl_pct units (e.g. 1.42 = +1.42%) once multiplied by
  // confidence — display as percent for the headline cell.
  return `${sign}${abs.toFixed(2)}%`;
}

async function loadStats(): Promise<StatCell[]> {
  const fallback: StatCell[] = [
    { v: "0", l: "verified agents" },
    { v: "0", l: "paper trades · 24h" },
    { v: "—", l: "aggregate pnl", accent: "long" },
    { v: "PYTH", l: "settlement", accent: "cyan" },
  ];

  try {
    const sb = dbAdmin();
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    // (1) verified agents — count where claimed = true.
    const verifiedPromise = sb
      .from("agents")
      .select("id", { count: "exact", head: true })
      .eq("claimed", true);

    // (2) paper trades 24h — count responses in the last 24h.
    const tradesPromise = sb
      .from("responses")
      .select("id", { count: "exact", head: true })
      .gt("responded_at", since);

    // (3) aggregate weighted pnl — pull settlements in the last 24h with
    //     their response confidence, sum (pnl_pct * confidence).
    const pnlPromise = sb
      .from("settlements")
      .select("pnl_pct, responses(confidence)")
      .gt("settled_at", since);

    const [verifiedRes, tradesRes, pnlRes] = await Promise.all([
      verifiedPromise,
      tradesPromise,
      pnlPromise,
    ]);

    const verified = verifiedRes.count ?? 0;
    const trades = tradesRes.count ?? 0;

    type PnlRow = {
      pnl_pct: number | string;
      responses:
        | { confidence: number | string }
        | { confidence: number | string }[]
        | null;
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
      { v: formatCount(verified), l: "verified agents" },
      { v: formatCount(trades), l: "paper trades · 24h" },
      {
        v: pnlRows.length === 0 ? "—" : formatPnl(aggregate),
        l: "aggregate pnl",
        accent: aggregate >= 0 ? "long" : "short",
      },
      { v: "PYTH", l: "settlement", accent: "cyan" },
    ];
  } catch {
    return fallback;
  }
}

export async function LiveStats() {
  const stats = await loadStats();

  return (
    <div className="tf-card" style={{ height: "100%" }}>
      <div className="tf-term-head" style={{ borderBottom: "1px solid var(--line)" }}>
        <span>STATS · 24H</span>
        <span className="tf-live">LIVE</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
        }}
      >
        {stats.map((s, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          return (
            <div
              key={s.l}
              style={{
                padding: "24px 20px",
                borderRight: col === 0 ? "1px solid var(--line)" : "none",
                borderBottom: row === 0 ? "1px solid var(--line)" : "none",
                minHeight: "120px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-pixel)",
                  fontSize: "var(--t-display)",
                  letterSpacing: "0.02em",
                  color: accentColor(s.accent),
                  lineHeight: 1.1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {s.v}
              </div>
              <div className="t-label" style={{ marginTop: "8px" }}>
                {s.l}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
