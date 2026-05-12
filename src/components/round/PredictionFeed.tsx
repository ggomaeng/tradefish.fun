"use client";

/**
 * PredictionFeed — animated card list of agent responses (and comments-with-direction)
 * for a round.
 *
 * Each card shows: agent name (linked), direction chip, confidence, position size,
 * entry price, reasoning/thesis text, and a single pnl_usd badge when settled.
 * The 1h/4h/24h triple is replaced by a single USD PnL badge.
 *
 * "Deliberating" pulse shown if round is open and 0 responses.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type {
  RoundResponse,
  RoundPaperTrade,
  RoundComment,
} from "@/lib/realtime/round";
import { FishAvatar } from "@/components/avatar/FishAvatar";

const DIR_LABEL = { buy: "▲ LONG", sell: "▼ SHORT", hold: "· HOLD" } as const;
const DIR_COLOR = {
  buy: "var(--up)",
  sell: "var(--down)",
  hold: "var(--hold)",
} as const;
const DIR_BG = {
  buy: "var(--up-bg)",
  sell: "var(--down-bg)",
  hold: "var(--hold-bg)",
} as const;
const DIR_BD = {
  buy: "var(--up-bd)",
  sell: "var(--down-bd)",
  hold: "var(--hold-bd)",
} as const;

interface Props {
  responses: RoundResponse[];
  comments: RoundComment[];
  paperTrades: RoundPaperTrade[];
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
  if (p >= 1000)
    return `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (p >= 1) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(6)}`;
}

function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000)
    return `$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${abs.toFixed(2)}`;
}

function PnlBadge({ pnlUsd }: { pnlUsd: number | undefined }) {
  if (pnlUsd === undefined) {
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
        unsettled
      </span>
    );
  }
  const sign = pnlUsd >= 0 ? "+" : "−";
  const color = pnlUsd >= 0 ? "var(--up)" : "var(--down)";
  const bg = pnlUsd >= 0 ? "var(--up-bg)" : "var(--down-bg)";
  const bd = pnlUsd >= 0 ? "var(--up-bd)" : "var(--down-bd)";
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
      {sign}
      {fmtUsd(pnlUsd)} PnL
    </span>
  );
}

// Unified entry: either a response or a comment-with-direction
type EntryCard = {
  id: string;
  kind: "response" | "comment";
  agentName: string;
  agentShortId: string;
  direction: "buy" | "sell" | "hold";
  confidence: number;
  positionSizeUsd: number;
  entryPrice: number;
  thesis: string | null;
  enteredAt: string;
};

export function PredictionFeed({
  responses,
  comments,
  paperTrades,
  isOpen,
  askedAt,
}: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  // Build pnl lookup: response_id → pnl_usd and comment_id → pnl_usd
  const pnlByResponseId = new Map<string, number>();
  const pnlByCommentId = new Map<string, number>();
  for (const pt of paperTrades) {
    if (pt.response_id) pnlByResponseId.set(pt.response_id, pt.pnl_usd);
    if (pt.comment_id) pnlByCommentId.set(pt.comment_id, pt.pnl_usd);
  }

  // Merge responses + comments-with-direction into unified entry list
  const entries: EntryCard[] = [];

  for (const r of responses) {
    entries.push({
      id: r.id,
      kind: "response",
      agentName: r.agent_name,
      agentShortId: r.agent_short_id,
      direction: r.answer,
      confidence: r.confidence,
      positionSizeUsd: r.position_size_usd,
      entryPrice: r.pyth_price_at_response,
      thesis: r.reasoning,
      enteredAt: r.responded_at,
    });
  }

  for (const c of comments) {
    if (c.direction && c.position_size_usd !== null && c.entry_price !== null) {
      entries.push({
        id: c.id,
        kind: "comment",
        agentName: c.agent_name,
        agentShortId: c.agent_short_id,
        direction: c.direction,
        confidence: c.confidence ?? 0,
        positionSizeUsd: c.position_size_usd,
        entryPrice: c.entry_price,
        thesis: c.body,
        enteredAt: c.created_at,
      });
    }
  }

  // Sort by entered time ascending
  entries.sort(
    (a, b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime(),
  );

  const [filter, setFilter] = useState<"all" | "buy" | "sell" | "hold">("all");

  const totalResponses = responses.length;
  const visible = entries.filter(
    (e) => filter === "all" || e.direction === filter,
  );
  const counts = {
    buy: entries.filter((e) => e.direction === "buy").length,
    sell: entries.filter((e) => e.direction === "sell").length,
    hold: entries.filter((e) => e.direction === "hold").length,
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
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
          Agent predictions
        </h3>
        <div style={{ display: "flex", gap: 6 }}>
          <FilterBtn active={filter === "all"} onClick={() => setFilter("all")}>
            All <Count n={entries.length} />
          </FilterBtn>
          <FilterBtn
            active={filter === "buy"}
            onClick={() => setFilter("buy")}
            color="var(--up)"
          >
            ▲ <Count n={counts.buy} />
          </FilterBtn>
          <FilterBtn
            active={filter === "sell"}
            onClick={() => setFilter("sell")}
            color="var(--down)"
          >
            ▼ <Count n={counts.sell} />
          </FilterBtn>
          <FilterBtn
            active={filter === "hold"}
            onClick={() => setFilter("hold")}
            color="var(--hold)"
          >
            · <Count n={counts.hold} />
          </FilterBtn>
        </div>
      </div>

      {totalResponses === 0 && isOpen ? (
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
          No {filter !== "all" ? `${filter} ` : ""}predictions yet.
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {visible.map((entry, i) => {
            const a = entry.direction;
            const offsetMs =
              new Date(entry.enteredAt).getTime() - new Date(askedAt).getTime();
            const pnlUsd =
              entry.kind === "response"
                ? pnlByResponseId.get(entry.id)
                : pnlByCommentId.get(entry.id);

            return (
              <motion.div
                key={entry.id}
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
                <FishAvatar
                  shortId={entry.agentShortId}
                  nameFallback={entry.agentName}
                  size={36}
                  style={{ border: `1px solid ${DIR_BD[a]}` }}
                />

                {/* Content */}
                <div>
                  {/* Metadata row — de-emphasized so reasoning dominates */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                      marginBottom: 8,
                    }}
                  >
                    <Link
                      href={`/agents/${entry.agentShortId}`}
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--fg)",
                        textDecoration: "none",
                      }}
                    >
                      {entry.agentName}
                    </Link>
                    {/* Comment badge */}
                    {entry.kind === "comment" && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 9,
                          padding: "1px 5px",
                          borderRadius: "var(--r-1)",
                          background: "var(--bg-3)",
                          color: "var(--fg-4)",
                          border: "1px solid var(--bd-1)",
                          letterSpacing: "0.08em",
                        }}
                      >
                        RE-ENTRY
                      </span>
                    )}
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        padding: "2px 7px",
                        borderRadius: "var(--r-2)",
                        color: DIR_COLOR[a],
                        background: DIR_BG[a],
                        border: `1px solid ${DIR_BD[a]}`,
                        letterSpacing: "0.06em",
                      }}
                    >
                      {DIR_LABEL[a]}
                    </span>
                    <span
                      className="num"
                      style={{ fontSize: 10, color: "var(--fg-4)" }}
                    >
                      {Number(entry.confidence).toFixed(2)} conf
                    </span>
                    <span
                      className="num"
                      style={{ fontSize: 10, color: "var(--fg-4)" }}
                    >
                      ${entry.positionSizeUsd.toFixed(0)} size
                    </span>
                    <span
                      className="num"
                      style={{ fontSize: 10, color: "var(--fg-4)" }}
                    >
                      @ {fmtPrice(entry.entryPrice)}
                    </span>
                  </div>

                  {/* Reasoning — the main content. Bigger, brighter, with a
                      side accent in the direction color so the agent's
                      thesis reads as the primary signal. */}
                  {entry.thesis && (
                    <div
                      style={{
                        fontSize: 14.5,
                        color: "var(--fg)",
                        lineHeight: 1.65,
                        maxWidth: 640,
                        marginBottom: 10,
                        paddingLeft: 12,
                        borderLeft: `2px solid ${DIR_BD[a]}`,
                      }}
                    >
                      {entry.thesis}
                    </div>
                  )}

                  {/* Conviction bar — confidence × (position_size / $1000).
                      Visually weights high-conviction-big-position agents so
                      the Tank can be skimmed at a glance. Top fillers
                      get a glow; low-conviction ones stay subtle. */}
                  {(() => {
                    const conv = Math.max(
                      0,
                      Math.min(
                        1,
                        Number(entry.confidence) *
                          (entry.positionSizeUsd / 1000),
                      ),
                    );
                    const showGlow = conv > 0.55;
                    return (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <div
                          style={{
                            position: "relative",
                            width: 96,
                            height: 4,
                            background: "var(--bg-3)",
                            borderRadius: "var(--r-1)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              width: `${conv * 100}%`,
                              background: DIR_COLOR[a],
                              boxShadow: showGlow
                                ? `0 0 8px ${DIR_BD[a]}`
                                : "none",
                              transition: "width 240ms var(--ease-out)",
                            }}
                          />
                        </div>
                        <span
                          className="num"
                          style={{
                            fontSize: 9,
                            color: "var(--fg-4)",
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          Conviction {Math.round(conv * 100)}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Settlement PnL badge — single, USD-denominated */}
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      marginTop: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <PnlBadge pnlUsd={pnlUsd} />
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
  return <span style={{ color: "var(--fg-4)", marginLeft: 3 }}>{n}</span>;
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
          style={{
            width: 8,
            height: 8,
            background: "var(--cyan)",
            borderRadius: "50%",
            animation: "pulse 2s infinite",
          }}
        />
        <span
          style={{
            fontSize: 13,
            color: "var(--fg-3)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.08em",
          }}
        >
          DELIBERATING…
        </span>
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: "var(--fg-4)" }}>
        Agents are analyzing the question
      </div>
    </div>
  );
}
