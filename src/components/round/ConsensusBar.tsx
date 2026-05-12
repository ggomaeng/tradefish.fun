"use client";

/**
 * ConsensusBar — 3-track consensus widget for a round.
 *
 * Track 1: Raw vote count (buy / sell / hold)
 * Track 2: Confidence-weighted lean (sum of confidence by direction)
 * Track 3: Direction-correct % from settlements (dimmed/placeholder when unsettled)
 *
 * The 60% threshold line appears on all tracks. When a track has no data
 * (e.g., unsettled round for track 3), it renders a muted placeholder row
 * rather than a broken 0% bar.
 */

type Response = {
  id: string;
  answer: "buy" | "sell" | "hold";
  confidence: number;
};

type Settlement = {
  response_id: string;
  direction_correct: boolean;
};

interface Props {
  responses: Response[];
  settlements: Settlement[];
}

export function ConsensusBar({ responses, settlements }: Props) {
  const total = responses.length;

  // Track 1 — raw vote counts
  const buyCount = responses.filter((r) => r.answer === "buy").length;
  const sellCount = responses.filter((r) => r.answer === "sell").length;
  const holdCount = responses.filter((r) => r.answer === "hold").length;
  const rawTotal = Math.max(1, buyCount + sellCount + holdCount);
  const rawLongPct = (buyCount / rawTotal) * 100;
  const rawShortPct = (sellCount / rawTotal) * 100;
  const rawHoldPct = (holdCount / rawTotal) * 100;

  // Track 2 — confidence-weighted lean
  const confBuy = responses
    .filter((r) => r.answer === "buy")
    .reduce((s, r) => s + r.confidence, 0);
  const confSell = responses
    .filter((r) => r.answer === "sell")
    .reduce((s, r) => s + r.confidence, 0);
  const confHold = responses
    .filter((r) => r.answer === "hold")
    .reduce((s, r) => s + r.confidence, 0);
  const confTotal = Math.max(0.001, confBuy + confSell + confHold);
  const confLongPct = (confBuy / confTotal) * 100;
  const confShortPct = (confSell / confTotal) * 100;
  const confHoldPct = (confHold / confTotal) * 100;
  const confLead = confLongPct >= 60 ? "LONG" : confShortPct >= 60 ? "SHORT" : "SPLIT";
  const confLeadPct = confLead === "LONG" ? confLongPct : confLead === "SHORT" ? confShortPct : null;

  // Track 3 — direction correct % (only for settled responses)
  const settledResponseIds = new Set(settlements.map((s) => s.response_id));
  const settledResponses = responses.filter((r) => settledResponseIds.has(r.id));
  const correctCount = settlements.filter((s) => s.direction_correct).length;
  const settledTotal = settledResponses.length;
  const correctPct = settledTotal > 0 ? (correctCount / settledTotal) * 100 : null;
  const hasSettlements = settlements.length > 0;

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
        sub={`${total} agent${total === 1 ? "" : "s"}`}
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

      {/* Track 2 — Confidence-weighted */}
      <TrackRow
        label="CONF-WEIGHTED"
        sub="by confidence sum"
        longPct={confLongPct}
        holdPct={confHoldPct}
        shortPct={confShortPct}
        summary={
          confLead === "SPLIT" ? (
            <span style={{ color: "var(--fg-3)" }}>SPLIT</span>
          ) : (
            <span style={{ color: confLead === "LONG" ? "var(--up)" : "var(--down)" }}>
              {confLead} · {confLeadPct?.toFixed(0)}%
            </span>
          )
        }
      />

      {/* Track 3 — Direction correct from settlements */}
      {hasSettlements ? (
        <TrackRow
          label="SETTLED CORRECT"
          sub={`${settledTotal} settled`}
          longPct={correctPct ?? 0}
          holdPct={0}
          shortPct={100 - (correctPct ?? 0)}
          correctMode
          summary={
            correctPct !== null ? (
              <span style={{ color: correctPct >= 50 ? "var(--up)" : "var(--down)" }}>
                {correctPct.toFixed(0)}% hit rate
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
            <div className="t-mini" style={{ color: "var(--fg-3)" }}>SETTLED CORRECT</div>
            <div style={{ fontSize: 10, color: "var(--fg-4)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
              pending 1h
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
  correctMode,
}: {
  label: string;
  sub: string;
  longPct: number;
  holdPct: number;
  shortPct: number;
  summary: React.ReactNode;
  correctMode?: boolean;
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
        {correctMode ? (
          // In correct mode: green = correct, red = incorrect
          <>
            <div style={{ width: `${longPct}%`, height: "100%", background: "var(--up)" }} />
            <div style={{ width: `${shortPct}%`, height: "100%", background: "var(--down)" }} />
          </>
        ) : (
          <>
            <div style={{ width: `${longPct}%`, height: "100%", background: "var(--up)" }} />
            <div style={{ width: `${holdPct}%`, height: "100%", background: "var(--hold)" }} />
            <div style={{ width: `${shortPct}%`, height: "100%", background: "var(--down)" }} />
          </>
        )}
      </div>
      <div style={{ fontSize: 11, color: "var(--fg-2)", fontFamily: "var(--font-mono)" }}>
        {summary}
      </div>
    </div>
  );
}
