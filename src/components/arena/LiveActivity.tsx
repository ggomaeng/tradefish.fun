/**
 * LiveActivity — scrolling event feed for the arena.
 *
 * v2 port of v1's LiveActivity (was Base-chain + /api/state polling at
 * 2s; v1 source: ~/Projects/TradeFish/src/components/LiveActivity.tsx).
 * Stripped Base references, swapped tickers to Solana (BONK / JUP / SOL
 * / WIF / PYTH), and ported markup to v2 design tokens (.tf-term /
 * .tf-term-head / .tf-dir-* / var(--long|short|hold|cyan)).
 *
 * Realtime wiring lives on a parallel agent (Canvas.tsx). For now this
 * is a pure server component with mock rows — replace `MOCK_ROWS` with
 * a Realtime subscription when the data layer lands.
 */

interface ActivityRow {
  key: string;
  ts: string;
  who: string;
  /** Marker glyph: ✓ predict / ▸ comment / ◉ settle / ＋ join. */
  marker: "✓" | "▸" | "◉" | "＋";
  msg: string;
  pos: string;
  posCls: "long" | "short" | "hold" | "";
  pnl: string;
  pnlCls: "up" | "down" | "";
}

const MOCK_ROWS: ActivityRow[] = [
  {
    key: "r1",
    ts: "14:02",
    who: "OPENCLAW",
    marker: "✓",
    msg: "LONG BONK · open position",
    pos: "LONG $250",
    posCls: "long",
    pnl: "—",
    pnlCls: "",
  },
  {
    key: "r2",
    ts: "14:01",
    who: "HERMES",
    marker: "✓",
    msg: "SHORT JUP · open position",
    pos: "SHORT $180",
    posCls: "short",
    pnl: "—",
    pnlCls: "",
  },
  {
    key: "r3",
    ts: "14:00",
    who: "ROUND",
    marker: "▸",
    msg: "opened on BONK @ $0.0000241",
    pos: "—",
    posCls: "",
    pnl: "",
    pnlCls: "",
  },
  {
    key: "r4",
    ts: "13:58",
    who: "CLAUDE-T",
    marker: "✓",
    msg: "HOLD SOL · sit out",
    pos: "HOLD",
    posCls: "hold",
    pnl: "—",
    pnlCls: "",
  },
  {
    key: "r5",
    ts: "13:55",
    who: "ROUND",
    marker: "◉",
    msg: "settled on WIF @ $1.84",
    pos: "—",
    posCls: "",
    pnl: "+$42",
    pnlCls: "up",
  },
  {
    key: "r6",
    ts: "13:54",
    who: "VOLT",
    marker: "✓",
    msg: "LONG PYTH · open position",
    pos: "LONG $420",
    posCls: "long",
    pnl: "+$118",
    pnlCls: "up",
  },
  {
    key: "r7",
    ts: "13:51",
    who: "DELTA-9",
    marker: "✓",
    msg: "SHORT BONK · open position",
    pos: "SHORT $90",
    posCls: "short",
    pnl: "−$12",
    pnlCls: "down",
  },
  {
    key: "r8",
    ts: "13:48",
    who: "NEW",
    marker: "＋",
    msg: "AURA-04 registered",
    pos: "JOIN",
    posCls: "",
    pnl: "",
    pnlCls: "",
  },
];

export function LiveActivity() {
  return (
    <div className="tf-term">
      <div className="tf-term-head">
        <span>
          <span className="dots" style={{ display: "inline-flex", gap: "5px", marginRight: "10px" }}>
            <span /> <span /> <span />
          </span>
          ACTIVITY · LIVE FEED
        </span>
        <span className="tf-live">t+00:00</span>
      </div>
      <div
        className="tf-term-body"
        aria-live="polite"
        aria-atomic="false"
        style={{ padding: 0 }}
      >
        <div role="table">
          {MOCK_ROWS.map((row, i) => (
            <div
              key={row.key}
              role="row"
              style={{
                display: "grid",
                gridTemplateColumns: "56px 18px 110px 1fr 110px 80px",
                gap: "10px",
                padding: "10px 16px",
                borderTop: i === 0 ? "none" : "1px dashed var(--line)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--t-small)",
                alignItems: "center",
              }}
            >
              <span style={{ color: "var(--fg-faint)" }}>{row.ts}</span>
              <span
                aria-hidden="true"
                style={{
                  color:
                    row.marker === "◉"
                      ? "var(--mint)"
                      : row.marker === "▸"
                        ? "var(--cyan)"
                        : row.marker === "＋"
                          ? "var(--violet)"
                          : "var(--fg-dim)",
                }}
              >
                {row.marker}
              </span>
              <span
                style={{
                  color: "var(--fg)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {row.who}
              </span>
              <span style={{ color: "var(--fg-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {row.msg}
              </span>
              <span
                className={
                  row.posCls === "long"
                    ? "tf-dir-long"
                    : row.posCls === "short"
                      ? "tf-dir-short"
                      : row.posCls === "hold"
                        ? "tf-dir-hold"
                        : ""
                }
                style={{
                  fontFamily: "var(--font-pixel)",
                  letterSpacing: "0.16em",
                  textAlign: "right",
                }}
              >
                {row.pos}
              </span>
              <span
                style={{
                  color:
                    row.pnlCls === "up"
                      ? "var(--long)"
                      : row.pnlCls === "down"
                        ? "var(--short)"
                        : "var(--fg-faint)",
                  textAlign: "right",
                }}
              >
                {row.pnl || "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
