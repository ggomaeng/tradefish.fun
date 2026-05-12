"use client";

/**
 * EntryStrip — horizontal price scatter for a round.
 *
 * Y-axis: price at entry with 5% margin.
 * X-axis: chronological index (0…n-1).
 * Dots: colored by direction (buy=green, sell=red, hold=amber).
 *       Size = sqrt(position_size_usd) * scale — bigger bet = bigger dot.
 * Dashed horizontal baseline = open price (pyth_price_at_ask).
 * Tooltip on hover shows agent name + direction + price + position size.
 */

const MIN_DOT_R = 3;
const MAX_DOT_R = 9;
const DOT_SCALE = 0.55; // r = sqrt(size) * scale, clamped [MIN_DOT_R, MAX_DOT_R]
const HEIGHT = 80;
const PAD_Y = 12;
const PAD_X_LEFT = 80;
const PAD_X_RIGHT = 60;

type Entry = {
  id: string;
  agentName: string;
  answer: "buy" | "sell" | "hold";
  price: number;
  positionSizeUsd: number;
  respondedAt: string;
};

interface Props {
  entries: Entry[];
  openPrice: number;
}

const DIR_COLOR = {
  buy: "var(--up)",
  sell: "var(--down)",
  hold: "var(--hold)",
} as const;

const DIR_LABEL = {
  buy: "▲ LONG",
  sell: "▼ SHORT",
  hold: "· HOLD",
} as const;

function dotRadius(sizeUsd: number): number {
  const r = Math.sqrt(Math.max(0, sizeUsd)) * DOT_SCALE;
  return Math.min(MAX_DOT_R, Math.max(MIN_DOT_R, r));
}

export function EntryStrip({ entries, openPrice }: Props) {
  if (entries.length === 0) return null;

  const prices = entries.map((e) => e.price).filter((p) => p > 0);
  if (openPrice > 0) prices.push(openPrice);

  const minP = prices.length ? Math.min(...prices) : openPrice || 0;
  const maxP = prices.length ? Math.max(...prices) : openPrice || 0;
  const span = Math.max(maxP - minP, openPrice * 0.001, 1);
  const lo = minP - span * 0.08;
  const hi = maxP + span * 0.08;
  const range = Math.max(hi - lo, 1);

  const innerH = HEIGHT - PAD_Y * 2;

  function yFor(p: number): number {
    return PAD_Y + ((hi - p) / range) * innerH;
  }

  const plotW = 500; // SVG units (viewBox)
  const trackLeft = PAD_X_LEFT;
  const trackRight = plotW - PAD_X_RIGHT;
  const trackW = trackRight - trackLeft;

  function xFor(i: number, n: number): number {
    if (n <= 1) return trackLeft + trackW / 2;
    return trackLeft + (i / (n - 1)) * trackW;
  }

  const baselineY = yFor(openPrice);

  function fmtPrice(p: number): string {
    if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    if (p >= 1) return `$${p.toFixed(4)}`;
    return `$${p.toFixed(6)}`;
  }

  return (
    <div
      style={{
        borderBottom: "1px solid var(--bd-1)",
        background: "rgba(15,15,17,0.6)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 6,
          left: 8,
          fontSize: 9,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--fg-4)",
          fontFamily: "var(--font-mono)",
          pointerEvents: "none",
        }}
      >
        SWARM ENTRIES
      </div>
      <div
        style={{
          position: "absolute",
          top: 6,
          right: 8,
          fontSize: 9,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--fg-4)",
          fontFamily: "var(--font-mono)",
          pointerEvents: "none",
        }}
      >
        {entries.length} POSTED
      </div>
      <svg
        viewBox={`0 0 ${plotW} ${HEIGHT}`}
        style={{ width: "100%", height: HEIGHT, display: "block" }}
        aria-label="Entry price scatter"
      >
        {/* Open price baseline */}
        {openPrice > 0 && (
          <>
            <line
              x1={trackLeft}
              y1={baselineY}
              x2={trackRight}
              y2={baselineY}
              stroke="var(--bd-3)"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <text
              x={trackLeft - 4}
              y={baselineY + 4}
              textAnchor="end"
              fontSize={8}
              fill="var(--fg-3)"
              fontFamily="var(--font-mono)"
              letterSpacing="0.06em"
            >
              OPEN {fmtPrice(openPrice)}
            </text>
          </>
        )}

        {/* Y-axis labels */}
        <text
          x={plotW - PAD_X_RIGHT + 6}
          y={PAD_Y + 4}
          fontSize={8}
          fill="var(--fg-4)"
          fontFamily="var(--font-mono)"
        >
          {fmtPrice(hi)}
        </text>
        <text
          x={plotW - PAD_X_RIGHT + 6}
          y={HEIGHT - PAD_Y}
          fontSize={8}
          fill="var(--fg-4)"
          fontFamily="var(--font-mono)"
        >
          {fmtPrice(lo)}
        </text>

        {/* Entry dots — size proportional to sqrt(position_size_usd) */}
        {entries.map((entry, i) => {
          const cx = xFor(i, entries.length);
          const cy = yFor(entry.price);
          const r = dotRadius(entry.positionSizeUsd);
          const color = DIR_COLOR[entry.answer];
          return (
            <g key={entry.id}>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={color}
                fillOpacity={0.85}
                stroke={color}
                strokeWidth={1}
                strokeOpacity={0.5}
              />
              {/* Invisible larger hit area for tooltip */}
              <circle cx={cx} cy={cy} r={r + 6} fill="transparent">
                <title>
                  {entry.agentName} · {DIR_LABEL[entry.answer]} · {fmtPrice(entry.price)} · ${entry.positionSizeUsd.toFixed(0)} size
                </title>
              </circle>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
