"use client";

/**
 * SettlementVerdict — animated settlement overlay for settled rounds.
 *
 * Mounts when the round has paper_trades (i.e. query is settled).
 * Shows:
 * - Vote distribution (LONG / SHORT / HOLD with animated bars) — from paperTrades
 * - Price open → close with delta %
 * - CONSENSUS RIGHT / WRONG / SPLIT verdict
 * - Top agent by pnl_usd
 *
 * Dismissable by click anywhere on overlay.
 */

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useState } from "react";
import type { RoundPaperTrade } from "@/lib/realtime/round";

export type VerdictData = {
  symbol: string;
  openPrice: number;
  closePrice: number; // query.close_price_pyth
  paperTrades: RoundPaperTrade[];
};

interface Props {
  data: VerdictData;
}

function computeVerdict(longCount: number, shortCount: number, netPnlByDirection: Record<string, number>): {
  label: string;
  color: string;
  borderColor: string;
} {
  const majority = longCount > shortCount ? "buy" : shortCount > longCount ? "sell" : null;
  if (majority === null) return { label: "SPLIT — NO CONSENSUS", color: "var(--hold)", borderColor: "var(--hold-bd)" };
  const majorityPnl = netPnlByDirection[majority] ?? 0;
  if (majorityPnl > 0) return { label: "CONSENSUS WAS RIGHT", color: "var(--up)", borderColor: "var(--up-bd)" };
  return { label: "CONSENSUS WAS WRONG", color: "var(--down)", borderColor: "var(--down-bd)" };
}

export function SettlementVerdict({ data }: Props) {
  const [visible, setVisible] = useState(true);
  const reduced = useReducedMotion();

  const { paperTrades } = data;

  // Direction counts
  const longCount = paperTrades.filter((t) => t.direction === "buy").length;
  const shortCount = paperTrades.filter((t) => t.direction === "sell").length;
  const holdCount = paperTrades.filter((t) => t.direction === "hold").length;

  const total = Math.max(1, longCount + shortCount + holdCount);
  const longPct = Math.round((longCount / total) * 100);
  const shortPct = Math.round((shortCount / total) * 100);
  const holdPct = Math.round((holdCount / total) * 100);

  // Net PnL by direction for consensus correctness
  const netPnlByDirection: Record<string, number> = {};
  for (const t of paperTrades) {
    netPnlByDirection[t.direction] = (netPnlByDirection[t.direction] ?? 0) + t.pnl_usd;
  }

  const verdict = computeVerdict(longCount, shortCount, netPnlByDirection);

  // Top agent by pnl_usd
  let topAgentName: string | null = null;
  let topAgentPnl: number | null = null;
  if (paperTrades.length > 0) {
    const top = paperTrades.reduce((best, cur) => cur.pnl_usd > best.pnl_usd ? cur : best);
    topAgentName = top.agent_name;
    topAgentPnl = top.pnl_usd;
  }

  const open = data.openPrice;
  const close = data.closePrice;
  const deltaPct = open > 0 ? ((close - open) / open) * 100 : 0;
  const moved = close >= open ? "UP" : "DOWN";
  const moveColor = close >= open ? "var(--up)" : "var(--down)";

  function fmtPrice(p: number): string {
    if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    if (p >= 1) return `$${p.toFixed(4)}`;
    return `$${p.toFixed(6)}`;
  }

  function fmtUsd(n: number): string {
    const abs = Math.abs(n);
    if (abs >= 1000) return `$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    return `$${abs.toFixed(2)}`;
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          onClick={() => setVisible(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background:
              "radial-gradient(ellipse at center, rgba(10,10,11,0.97) 0%, rgba(6,6,8,0.99) 70%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            cursor: "pointer",
          }}
          aria-label="Settlement verdict. Click to dismiss."
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            style={{
              width: "min(860px, 100%)",
              display: "flex",
              flexDirection: "column",
              gap: 24,
              cursor: "default",
            }}
          >
            {/* Eyebrow */}
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.35 }}
              style={{
                fontSize: 12,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--cyan)",
                fontFamily: "var(--font-mono)",
              }}
            >
              ROUND CLOSED · {data.symbol}/USD · SETTLED
            </motion.div>

            {/* Question */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.35 }}
              style={{
                fontSize: 26,
                lineHeight: 1.25,
                color: "var(--fg)",
                letterSpacing: "0.01em",
                opacity: 0.92,
              }}
            >
              "Buy or sell <span style={{ color: "var(--cyan)" }}>{data.symbol}</span> right now?"
            </motion.div>

            {/* Votes */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.3 }}
              style={{
                fontSize: 11,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--fg-3)",
                fontFamily: "var(--font-mono)",
              }}
            >
              THE SWARM VOTED
            </motion.div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <VoteRow label="LONG" count={longCount} pct={longPct} color="var(--up)" delay={0.85} reduced={reduced ?? false} />
              <VoteRow label="SHORT" count={shortCount} pct={shortPct} color="var(--down)" delay={1.1} reduced={reduced ?? false} />
              {holdCount > 0 && (
                <VoteRow label="HOLD" count={holdCount} pct={holdPct} color="var(--hold)" delay={1.35} reduced={reduced ?? false} />
              )}
            </div>

            {/* Price move */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8, duration: 0.35 }}
              style={{
                borderTop: "1px solid var(--bd-2)",
                borderBottom: "1px solid var(--bd-2)",
                padding: "18px 0",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "var(--fg-3)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                MARKET MOVED
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "baseline",
                  fontFamily: "var(--font-mono)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span style={{ fontSize: 34, color: "var(--fg)" }}>{fmtPrice(open)}</span>
                <span style={{ fontSize: 24, color: "var(--fg-3)" }}>→</span>
                <span style={{ fontSize: 34, color: moveColor }}>{fmtPrice(close)}</span>
                <span style={{ fontSize: 20, color: moveColor, marginLeft: "auto" }}>
                  {close >= open ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(2)}%
                </span>
              </div>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "var(--fg-3)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {data.symbol} CLOSED {moved}
              </div>
            </motion.div>

            {/* Verdict */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 2.6, duration: 0.45, ease: "easeOut" }}
              style={{
                alignSelf: "flex-start",
                fontSize: 22,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontFamily: "var(--font-mono)",
                padding: "14px 28px",
                border: `2px solid ${verdict.borderColor}`,
                borderRadius: "var(--r-2)",
                color: verdict.color,
                background: "rgba(0,0,0,0.3)",
              }}
            >
              {verdict.label}
            </motion.div>

            {/* Top agent */}
            {topAgentName && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 3.4, duration: 0.35 }}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 14,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color: "var(--cyan)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  TOP AGENT
                </span>
                <span style={{ fontSize: 16, color: "var(--fg)" }}>{topAgentName}</span>
                {topAgentPnl !== null && (
                  <span
                    className="num"
                    style={{
                      fontSize: 18,
                      color: topAgentPnl >= 0 ? "var(--up)" : "var(--down)",
                      marginLeft: "auto",
                    }}
                  >
                    {topAgentPnl >= 0 ? "+" : "−"}{fmtUsd(topAgentPnl)}
                  </span>
                )}
              </motion.div>
            )}

            {/* Dismiss hint */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ delay: 4.2, duration: 0.35 }}
              style={{
                fontSize: 11,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--fg-4)",
                fontFamily: "var(--font-mono)",
                textAlign: "center",
              }}
            >
              CLICK ANYWHERE TO DISMISS
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function VoteRow({
  label,
  count,
  pct,
  color,
  delay,
  reduced,
}: {
  label: string;
  count: number;
  pct: number;
  color: string;
  delay: number;
  reduced: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.3 }}
      style={{
        display: "grid",
        gridTemplateColumns: "80px 1fr 100px",
        alignItems: "center",
        gap: 16,
        fontSize: 16,
        fontFamily: "var(--font-mono)",
      }}
    >
      <span style={{ letterSpacing: "0.14em", fontWeight: 600, color }}>{label}</span>
      <div
        style={{
          height: 10,
          background: "var(--bg-3)",
          borderRadius: "var(--r-1)",
          overflow: "hidden",
          border: "1px solid var(--bd-1)",
        }}
      >
        <motion.div
          initial={{ width: reduced ? `${pct}%` : 0 }}
          animate={{ width: `${pct}%` }}
          transition={{
            delay: delay + 0.1,
            duration: reduced ? 0 : 0.7,
            ease: "easeOut",
          }}
          style={{ height: "100%", background: color, borderRadius: "var(--r-1)" }}
        />
      </div>
      <span
        className="num"
        style={{ textAlign: "right", color: "var(--fg)" }}
      >
        {count} <span style={{ color: "var(--fg-3)", fontSize: 12 }}>· {pct}%</span>
      </span>
    </motion.div>
  );
}
