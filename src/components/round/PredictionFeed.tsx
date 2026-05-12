"use client";

/**
 * PredictionFeed — animated card list of agent responses for a round.
 *
 * Each card shows: agent name (linked), direction chip, confidence,
 * entry price, reasoning text, and settlement PnL badges for each
 * horizon (1h/4h/24h) when settled.
 *
 * "Deliberating" pulse shown if round is open and 0 responses.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { RoundResponse, RoundSettlement } from "@/lib/realtime/round";

const DIR_LABEL = { buy: "▲ LONG", sell: "▼ SHORT", hold: "· HOLD" } as const;
const DIR_COLOR = { buy: "var(--up)", sell: "var(--down)", hold: "var(--hold)" } as const;
const DIR_BG = { buy: "var(--up-bg)", sell: "var(--down-bg)", hold: "var(--hold-bg)" } as const;
const DIR_BD = { buy: "var(--up-bd)", sell: "var(--down-bd)", hold: "var(--hold-bd)" } as const;

interface Props {
  responses: RoundResponse[];
  settlements: RoundSettlement[];
  isOpen: boolean;
  askedAt: string;
}

function formatOffset(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) {
    return `+${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `+${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtPrice(p: number): string {
  if (p >= 1000) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (p >= 1) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(6)}`;
}

function PnlBadge({ horizon, settlement }: { horizon: "1h" | "4h" | "24h"; settlement?: RoundSettlement }) {
  if (!settlement) {
    return (
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          padding: "2px 7px",
          borderRadius: "var(--r-1)",
          background: "var(--bg-3)",
          color: "var(--fg-4)",
          border: "1px solid var(--bd-1)",
        }}
      >
        {horizon} —
      </span>
    );
  }
  const sign = settlement.pnl_pct >= 0 ? "+" : "";
  const color = settlement.pnl_pct >= 0 ? "var(--up)" : "var(--down)";
  const bg = settlement.pnl_pct >= 0 ? "var(--up-bg)" : "var(--down-bg)";
  const bd = settlement.pnl_pct >= 0 ? "var(--up-bd)" : "var(--down-bd)";
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        padding: "2px 7px",
        borderRadius: "var(--r-1)",
        background: bg,
        color,
        border: `1px solid ${bd}`,
      }}
    >
      {horizon} {sign}{settlement.pnl_pct.toFixed(2)}%
    </span>
  );
}

export function PredictionFeed({ responses, settlements, isOpen, askedAt }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  const settleByResponseAndHorizon = new Map<string, RoundSettlement>();
  for (const s of settlements) {
    settleByResponseAndHorizon.set(`${s.response_id}:${s.horizon}`, s);
  }

  const [filter, setFilter] = useState<"all" | "buy" | "sell" | "hold">("all");

  const visible = responses.filter((r) => filter === "all" || r.answer === filter);
  const counts = {
    buy: responses.filter((r) => r.answer === "buy").length,
    sell: responses.filter((r) => r.answer === "sell").length,
    hold: responses.filter((r) => r.answer === "hold").length,
  };

  return (
    <div style={{ padding: "0 0 32px" }}>
      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 32px 16px",
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Agent responses</h3>
        <div style={{ display: "flex", gap: 6 }}>
          <FilterBtn active={filter === "all"} onClick={() => setFilter("all")}>
            All <Count n={responses.length} />
          </FilterBtn>
          <FilterBtn active={filter === "buy"} onClick={() => setFilter("buy")} color="var(--up)">
            ▲ <Count n={counts.buy} />
          </FilterBtn>
          <FilterBtn active={filter === "sell"} onClick={() => setFilter("sell")} color="var(--down)">
            ▼ <Count n={counts.sell} />
          </FilterBtn>
          <FilterBtn active={filter === "hold"} onClick={() => setFilter("hold")} color="var(--hold)">
            · <Count n={counts.hold} />
          </FilterBtn>
        </div>
      </div>

      {responses.length === 0 && isOpen ? (
        <DeliberatingPulse />
      ) : visible.length === 0 ? (
        <div
          style={{
            padding: "48px 32px",
            textAlign: "center",
            fontSize: 13,
            color: "var(--fg-3)",
          }}
        >
          No {filter !== "all" ? `${filter} ` : ""}responses yet.
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {visible.map((r, i) => {
            const a = r.answer;
            const offsetMs =
              new Date(r.responded_at).getTime() - new Date(askedAt).getTime();
            const s1h = settleByResponseAndHorizon.get(`${r.id}:1h`);
            const s4h = settleByResponseAndHorizon.get(`${r.id}:4h`);
            const s24h = settleByResponseAndHorizon.get(`${r.id}:24h`);
            const hasAnySettlement = !!(s1h || s4h || s24h);
            const initials = r.agent_name.slice(0, 2).toUpperCase();

            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i < 6 ? i * 0.04 : 0, duration: 0.25 }}
                style={{
                  padding: "16px 32px",
                  borderBottom: "1px solid var(--bd-1)",
                  display: "grid",
                  gridTemplateColumns: "72px 36px 1fr",
                  gap: 14,
                }}
              >
                {/* Offset timestamp */}
                <div
                  className="num"
                  style={{ fontSize: 11, color: "var(--fg-3)", paddingTop: 8 }}
                >
                  {formatOffset(offsetMs)}
                </div>

                {/* Avatar */}
                <div
                  className="av"
                  style={{
                    width: 36,
                    height: 36,
                    background: DIR_BG[a],
                    border: `1px solid ${DIR_BD[a]}`,
                    color: DIR_COLOR[a],
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>

                {/* Content */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                      marginBottom: 6,
                    }}
                  >
                    <Link
                      href={`/agents/${r.agent_short_id}`}
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--fg)",
                        textDecoration: "none",
                      }}
                    >
                      {r.agent_name}
                    </Link>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: "var(--r-2)",
                        color: DIR_COLOR[a],
                        background: DIR_BG[a],
                        border: `1px solid ${DIR_BD[a]}`,
                      }}
                    >
                      {DIR_LABEL[a]}
                    </span>
                    <span
                      className="num"
                      style={{ fontSize: 11, color: "var(--fg-3)" }}
                    >
                      {Number(r.confidence).toFixed(2)} conf
                    </span>
                    <span
                      className="num"
                      style={{ fontSize: 11, color: "var(--fg-3)" }}
                    >
                      @ {fmtPrice(r.pyth_price_at_response)}
                    </span>
                  </div>

                  {r.reasoning && (
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--fg-2)",
                        lineHeight: 1.6,
                        maxWidth: 560,
                        marginBottom: hasAnySettlement ? 10 : 0,
                      }}
                    >
                      {r.reasoning}
                    </div>
                  )}

                  {/* Settlement PnL badges */}
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <PnlBadge horizon="1h" settlement={s1h} />
                    <PnlBadge horizon="4h" settlement={s4h} />
                    <PnlBadge horizon="24h" settlement={s24h} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}
    </div>
  );
}

function FilterBtn({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        padding: "4px 10px",
        borderRadius: "var(--r-2)",
        border: `1px solid ${active ? "var(--bd-3)" : "var(--bd-1)"}`,
        background: active ? "var(--bg-3)" : "transparent",
        color: active ? (color ?? "var(--fg)") : "var(--fg-3)",
        cursor: "pointer",
        transition: "all 120ms",
      }}
    >
      {children}
    </button>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span style={{ color: "var(--fg-4)", marginLeft: 3 }}>{n}</span>
  );
}

function DeliberatingPulse() {
  return (
    <div
      style={{
        padding: "48px 32px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 20px",
          borderRadius: "var(--r-3)",
          border: "1px solid var(--bd-2)",
          background: "var(--bg-2)",
        }}
      >
        <span
          className="dot"
          style={{ width: 8, height: 8, background: "var(--cyan)", borderRadius: "50%", animation: "pulse 2s infinite" }}
        />
        <span style={{ fontSize: 13, color: "var(--fg-3)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
          DELIBERATING…
        </span>
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: "var(--fg-4)" }}>
        Agents are analyzing the question
      </div>
    </div>
  );
}
