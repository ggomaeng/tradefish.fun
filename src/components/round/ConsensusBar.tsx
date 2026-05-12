"use client";

/**
 * ConsensusBar — 3-track consensus widget for a round.
 *
 * Track 1: Raw vote count — % of trades (responses + comments-with-direction) by direction
 * Track 2: Size-weighted notional — sum positionSizeUsd by direction / total notional
 * Track 3: PnL-weighted lean — settled trades only: sum pnl_usd by direction / total abs PnL.
 *          Shows "pending" placeholder when not settled.
 *
 * The 60% threshold line appears on all tracks.
 */

type EntryInput = {
  id: string;
  direction: "buy" | "sell" | "hold";
  positionSizeUsd: number;
};

type PaperTradeInput = {
  direction: "buy" | "sell" | "hold";
  position_size_usd: number;
  pnl_usd: number;
};

interface Props {
  entries: EntryInput[];
  paperTrades: PaperTradeInput[];
}

export function ConsensusBar({ entries, paperTrades }: Props) {
  const total = entries.length;

  // Track 1 — raw vote counts
  const buyCount = entries.filter((e) => e.direction === "buy").length;
  const sellCount = entries.filter((e) => e.direction === "sell").length;
  const holdCount = entries.filter((e) => e.direction === "hold").length;
  const rawTotal = Math.max(1, buyCount + sellCount + holdCount);
  const rawLongPct = (buyCount / rawTotal) * 100;
  const rawShortPct = (sellCount / rawTotal) * 100;
  const rawHoldPct = (holdCount / rawTotal) * 100;

  // Track 2 — size-weighted notional
  const sizeBuy = entries
    .filter((e) => e.direction === "buy")
    .reduce((s, e) => s + e.positionSizeUsd, 0);
  const sizeSell = entries
    .filter((e) => e.direction === "sell")
    .reduce((s, e) => s + e.positionSizeUsd, 0);
  const sizeHold = entries
    .filter((e) => e.direction === "hold")
    .reduce((s, e) => s + e.positionSizeUsd, 0);
  const sizeTotal = Math.max(0.001, sizeBuy + sizeSell + sizeHold);
  const sizeLongPct = (sizeBuy / sizeTotal) * 100;
  const sizeShortPct = (sizeSell / sizeTotal) * 100;
  const sizeHoldPct = (sizeHold / sizeTotal) * 100;
  const sizeLead = sizeLongPct >= 60 ? "LONG" : sizeShortPct >= 60 ? "SHORT" : "SPLIT";
  const sizeLeadPct = sizeLead === "LONG" ? sizeLongPct : sizeLead === "SHORT" ? sizeShortPct : null;

  // Track 3 — PnL-weighted lean (settled only)
  const hasPaperTrades = paperTrades.length > 0;

  const pnlBuy = paperTrades
    .filter((t) => t.direction === "buy")
    .reduce((s, t) => s + Math.abs(t.pnl_usd), 0);
  const pnlSell = paperTrades
    .filter((t) => t.direction === "sell")
    .reduce((s, t) => s + Math.abs(t.pnl_usd), 0);
  const pnlHold = paperTrades
    .filter((t) => t.direction === "hold")
    .reduce((s, t) => s + Math.abs(t.pnl_usd), 0);
  const pnlTotal = Math.max(0.001, pnlBuy + pnlSell + pnlHold);
  const pnlLongPct = hasPaperTrades ? (pnlBuy / pnlTotal) * 100 : 0;
  const pnlShortPct = hasPaperTrades ? (pnlSell / pnlTotal) * 100 : 0;
  const pnlHoldPct = hasPaperTrades ? (pnlHold / pnlTotal) * 100 : 0;

  // Net PnL by direction for summary label
  const netBuy = paperTrades.filter((t) => t.direction === "buy").reduce((s, t) => s + t.pnl_usd, 0);
  const netSell = paperTrades.filter((t) => t.direction === "sell").reduce((s, t) => s + t.pnl_usd, 0);
  const pnlWinner = hasPaperTrades
    ? Math.abs(netBuy) >= Math.abs(netSell) ? (netBuy >= 0 ? "LONG" : "SHORT") : (netSell >= 0 ? "SHORT" : "LONG")
    : null;

  if (total === 0) return null;

  return (
    <div
      style={{
        padding: "20px 32px",
        borderBottom: "1px solid var(--bd-1)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div className="t-mini" style={{ marginBottom: 2, color: "var(--fg-3)" }}>CONSENSUS</div>

      {/* Track 1 — Raw votes */}
      <TrackRow
        label="RAW VOTE"
        sub={`${total} trade${total === 1 ? "" : "s"}`}
        longPct={rawLongPct}
        holdPct={rawHoldPct}
        shortPct={rawShortPct}
        summary={
          <span>
            <span style={{ color: "var(--up)" }}>L {rawLongPct.toFixed(0)}%</span>
            <span style={{ color: "var(--fg-4)", margin: "0 4px" }}>·</span>
            <span style={{ color: "var(--hold)" }}>H {rawHoldPct.toFixed(0)}%</span>
            <span style={{ color: "var(--fg-4)", margin: "0 4px" }}>·</span>
            <span style={{ color: "var(--down)" }}>S {rawShortPct.toFixed(0)}%</span>
          </span>
        }
      />

      {/* Track 2 — Size-weighted notional */}
      <TrackRow
        label="SIZE NOTIONAL"
        sub={`$${sizeTotal.toFixed(0)} total`}
        longPct={sizeLongPct}
        holdPct={sizeHoldPct}
        shortPct={sizeShortPct}
        summary={
          sizeLead === "SPLIT" ? (
            <span style={{ color: "var(--fg-3)" }}>SPLIT</span>
          ) : (
            <span style={{ color: sizeLead === "LONG" ? "var(--up)" : "var(--down)" }}>
              {sizeLead} · {sizeLeadPct?.toFixed(0)}%
            </span>
          )
        }
      />

      {/* Track 3 — PnL-weighted lean (settled) */}
      {hasPaperTrades ? (
        <TrackRow
          label="PnL WEIGHT"
          sub={`${paperTrades.length} settled`}
          longPct={pnlLongPct}
          holdPct={pnlHoldPct}
          shortPct={pnlShortPct}
          summary={
            pnlWinner ? (
              <span style={{ color: pnlWinner === "LONG" ? "var(--up)" : "var(--down)" }}>
                {pnlWinner} wins
              </span>
            ) : (
              <span style={{ color: "var(--fg-4)" }}>—</span>
            )
          }
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "140px 1fr 160px",
            gap: 12,
            alignItems: "center",
            opacity: 0.35,
          }}
        >
          <div>
            <div className="t-mini" style={{ color: "var(--fg-3)" }}>PnL WEIGHT</div>
            <div style={{ fontSize: 10, color: "var(--fg-4)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
              pending
            </div>
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: "var(--bg-3)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "60%",
                top: 0,
                bottom: 0,
                width: 1,
                background: "var(--bd-2)",
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: "var(--fg-4)", fontFamily: "var(--font-mono)" }}>
            awaiting settlement
          </div>
        </div>
      )}
    </div>
  );
}

function TrackRow({
  label,
  sub,
  longPct,
  holdPct,
  shortPct,
  summary,
}: {
  label: string;
  sub: string;
  longPct: number;
  holdPct: number;
  shortPct: number;
  summary: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr 160px",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div>
        <div className="t-mini" style={{ color: "var(--fg-3)" }}>{label}</div>
        <div
          style={{
            fontSize: 10,
            color: "var(--fg-4)",
            fontFamily: "var(--font-mono)",
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: "var(--bg-3)",
          overflow: "hidden",
          display: "flex",
          position: "relative",
        }}
      >
        {/* 60% threshold marker */}
        <div
          style={{
            position: "absolute",
            left: "60%",
            top: 0,
            bottom: 0,
            width: 1,
            background: "var(--bd-3)",
            zIndex: 2,
          }}
        />
        <div style={{ width: `${longPct}%`, height: "100%", background: "var(--up)" }} />
        <div style={{ width: `${holdPct}%`, height: "100%", background: "var(--hold)" }} />
        <div style={{ width: `${shortPct}%`, height: "100%", background: "var(--down)" }} />
      </div>
      <div style={{ fontSize: 11, color: "var(--fg-2)", fontFamily: "var(--font-mono)" }}>
        {summary}
      </div>
    </div>
  );
}
