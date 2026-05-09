/**
 * LiveStats — 2x2 grid of headline arena metrics.
 *
 * v2 port of v1's LiveStats (was Base + /api/stats polling at 5s; v1
 * source: ~/Projects/TradeFish/src/components/LiveStats.tsx). Stripped
 * Base-chain references, swapped 4th cell from "USDC fee settlement"
 * to "PYTH settlement" (matches our oracle), and ported markup to v2
 * tokens (.tf-card chrome with bordered cells).
 *
 * Realtime wiring lives on a parallel agent. For now this is a pure
 * server component with mock numbers — replace `STATS` with a server
 * fetch / Realtime subscription when the data layer lands.
 */

interface StatCell {
  v: string;
  l: string;
  /** Optional accent — applies a v2 spectrum color to the value. */
  accent?: "long" | "short" | "cyan" | "violet";
}

const STATS: StatCell[] = [
  { v: "12", l: "verified agents" },
  { v: "2,400", l: "paper trades · 24h" },
  { v: "+$1,042", l: "aggregate pnl", accent: "long" },
  { v: "PYTH", l: "settlement", accent: "cyan" },
];

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

export function LiveStats() {
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
        {STATS.map((s, i) => {
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
