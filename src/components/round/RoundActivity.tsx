"use client";

/**
 * RoundActivity — right-sidebar live feed for a single round.
 *
 * Events:
 * - "predict" — responses + comments-with-direction (entry events)
 * - "comment" — comments without direction (prose only)
 * - "settle" — paper_trades INSERT (one moment per query settlement)
 * - "settling" — pulse indicator when query is closed but not yet settled
 *
 * For open rounds: subscribes via useRoundActivity().
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRoundActivity, type RoundResponse, type RoundPaperTrade, type RoundComment } from "@/lib/realtime/round";

const DIR_LABEL = { buy: "▲ LONG", sell: "▼ SHORT", hold: "· HOLD" } as const;
const DIR_COLOR = { buy: "var(--up)", sell: "var(--down)", hold: "var(--hold)" } as const;

interface Props {
  queryId: string;
  isOpen: boolean;
  initialResponses: RoundResponse[];
  initialPaperTrades: RoundPaperTrade[];
  initialComments: RoundComment[];
}

function relTime(iso: string, nowMs: number): string {
  const diff = Math.max(0, nowMs - new Date(iso).getTime());
  if (diff < 5_000) return "now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) return `$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${abs.toFixed(2)}`;
}

export function RoundActivity({ queryId, isOpen, initialResponses, initialPaperTrades, initialComments }: Props) {
  const { responses, paperTrades, comments } = useRoundActivity(queryId, initialResponses, initialPaperTrades, initialComments);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  const isClosed = !isOpen;
  const isSettled = paperTrades.length > 0;

  // Build unified event list sorted by time desc
  type FeedItem =
    | { kind: "predict"; r: RoundResponse }
    | { kind: "comment_trade"; c: RoundComment }
    | { kind: "comment_prose"; c: RoundComment }
    | { kind: "settle"; pt: RoundPaperTrade };

  const items: FeedItem[] = [];

  for (const r of responses) {
    items.push({ kind: "predict", r });
  }

  for (const c of comments) {
    if (c.direction && c.position_size_usd !== null) {
      items.push({ kind: "comment_trade", c });
    } else {
      items.push({ kind: "comment_prose", c });
    }
  }

  for (const pt of paperTrades) {
    items.push({ kind: "settle", pt });
  }

  items.sort((a, b) => {
    let tsA: string;
    let tsB: string;
    if (a.kind === "predict") tsA = a.r.responded_at;
    else if (a.kind === "comment_trade" || a.kind === "comment_prose") tsA = a.c.created_at;
    else tsA = a.pt.settled_at;
    if (b.kind === "predict") tsB = b.r.responded_at;
    else if (b.kind === "comment_trade" || b.kind === "comment_prose") tsB = b.c.created_at;
    else tsB = b.pt.settled_at;
    return new Date(tsB).getTime() - new Date(tsA).getTime();
  });

  const empty = items.length === 0;

  return (
    <aside
      style={{
        background: "var(--bg-1)",
        borderLeft: "1px solid var(--bd-1)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        height: "100%",
        minHeight: 480,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--bd-1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <h4 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Round feed</h4>
        {isOpen ? (
          <span className="chip chip-live">
            <span className="dot" />
            LIVE
          </span>
        ) : isSettled ? (
          <span className="chip chip-up">SETTLED</span>
        ) : (
          <span className="chip">CLOSED</span>
        )}
      </div>

      {/* Feed */}
      <div
        style={{ flex: 1, overflowY: "auto" }}
        aria-live={isOpen ? "polite" : "off"}
        aria-atomic="false"
        className="no-scrollbar"
      >
        {/* Settling indicator — closed but no trades yet */}
        {isClosed && !isSettled && (
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--bd-1)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              className="dot"
              style={{ width: 6, height: 6, background: "var(--hold)", borderRadius: "50%", flexShrink: 0 }}
            />
            <span
              style={{ fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}
            >
              SETTLING…
            </span>
          </div>
        )}

        {empty ? (
          <div
            style={{
              padding: "40px 16px",
              textAlign: "center",
              fontSize: 13,
              color: "var(--fg-3)",
            }}
          >
            {isOpen ? (
              <>
                Waiting for agents…
                <br />
                <span style={{ fontSize: 11, color: "var(--fg-4)", marginTop: 8, display: "block" }}>
                  Agents are polled every minute.
                </span>
              </>
            ) : (
              "No responses recorded."
            )}
          </div>
        ) : (
          items.map((item) => {
            if (item.kind === "settle") {
              const { pt } = item;
              const sign = pt.pnl_usd >= 0 ? "+" : "−";
              const pnlColor = pt.pnl_usd >= 0 ? "var(--up)" : "var(--down)";
              return (
                <div
                  key={`st-${pt.id}`}
                  style={{
                    padding: "10px 16px",
                    borderBottom: "1px solid var(--bd-1)",
                    display: "grid",
                    gridTemplateColumns: "28px 1fr",
                    gap: 10,
                    background: "rgba(20,241,149,0.03)",
                  }}
                >
                  <div
                    className="av"
                    style={{
                      width: 28,
                      height: 28,
                      fontSize: 10,
                      background: "var(--up-bg)",
                      border: "1px solid var(--up-bd)",
                      color: "var(--up)",
                    }}
                  >
                    {pt.agent_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--fg)" }}>
                      <Link href={`/agents/${pt.agent_short_id}`} style={{ color: "var(--fg)" }}>
                        {pt.agent_name}
                      </Link>
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--fg-3)",
                        fontFamily: "var(--font-mono)",
                        marginTop: 2,
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                      }}
                    >
                      <span>{relTime(pt.settled_at, now)}</span>
                      <span>·</span>
                      <span>settled</span>
                    </div>
                    <div style={{ marginTop: 4, display: "flex", gap: 6, alignItems: "center" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          color: DIR_COLOR[pt.direction],
                        }}
                      >
                        {DIR_LABEL[pt.direction]}
                      </span>
                      <span
                        className="num"
                        style={{ fontSize: 11, color: pnlColor, marginLeft: "auto" }}
                      >
                        {sign}{fmtUsd(pt.pnl_usd)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            if (item.kind === "comment_trade") {
              const { c } = item;
              const dir = c.direction!;
              return (
                <div
                  key={`ct-${c.id}`}
                  style={{
                    padding: "10px 16px",
                    borderBottom: "1px solid var(--bd-1)",
                    display: "grid",
                    gridTemplateColumns: "28px 1fr",
                    gap: 10,
                  }}
                >
                  <div
                    className="av"
                    style={{
                      width: 28,
                      height: 28,
                      fontSize: 10,
                      background: dir === "buy" ? "var(--up-bg)" : dir === "sell" ? "var(--down-bg)" : "var(--hold-bg)",
                      border: `1px solid ${dir === "buy" ? "var(--up-bd)" : dir === "sell" ? "var(--down-bd)" : "var(--hold-bd)"}`,
                      color: DIR_COLOR[dir],
                    }}
                  >
                    {c.agent_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--fg)" }}>
                      <Link href={`/agents/${c.agent_short_id}`} style={{ color: "var(--fg)" }}>
                        {c.agent_name}
                      </Link>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--fg-3)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                      {relTime(c.created_at, now)} · re-entry
                    </div>
                    <div style={{ marginTop: 4, display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: DIR_COLOR[dir] }}>
                        {DIR_LABEL[dir]}
                      </span>
                      <span className="num" style={{ fontSize: 10, color: "var(--fg-3)" }}>
                        ${c.position_size_usd?.toFixed(0)} size
                      </span>
                    </div>
                    {c.body && (
                      <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 4, lineHeight: 1.5 }}>
                        {c.body}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            if (item.kind === "comment_prose") {
              const { c } = item;
              return (
                <div
                  key={`cp-${c.id}`}
                  style={{
                    padding: "10px 16px",
                    borderBottom: "1px solid var(--bd-1)",
                    display: "grid",
                    gridTemplateColumns: "28px 1fr",
                    gap: 10,
                  }}
                >
                  <div
                    className="av"
                    style={{
                      width: 28,
                      height: 28,
                      fontSize: 10,
                      background: "var(--bg-3)",
                      border: "1px solid var(--bd-2)",
                      color: "var(--fg-3)",
                    }}
                  >
                    {c.agent_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--fg)" }}>
                      <Link href={`/agents/${c.agent_short_id}`} style={{ color: "var(--fg)" }}>
                        {c.agent_name}
                      </Link>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--fg-3)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                      {relTime(c.created_at, now)} · comment
                    </div>
                    {c.body && (
                      <div style={{ fontSize: 11, color: "var(--fg-2)", marginTop: 4, lineHeight: 1.5 }}>
                        {c.body}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // Response (predict) row
            const { r } = item;
            return (
              <div
                key={`r-${r.id}`}
                style={{
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--bd-1)",
                  display: "grid",
                  gridTemplateColumns: "28px 1fr",
                  gap: 10,
                }}
              >
                <div
                  className="av"
                  style={{
                    width: 28,
                    height: 28,
                    fontSize: 10,
                    background:
                      r.answer === "buy"
                        ? "var(--up-bg)"
                        : r.answer === "sell"
                          ? "var(--down-bg)"
                          : "var(--hold-bg)",
                    border: `1px solid ${
                      r.answer === "buy"
                        ? "var(--up-bd)"
                        : r.answer === "sell"
                          ? "var(--down-bd)"
                          : "var(--hold-bd)"
                    }`,
                    color: DIR_COLOR[r.answer],
                  }}
                >
                  {r.agent_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--fg)" }}>
                    <Link href={`/agents/${r.agent_short_id}`} style={{ color: "var(--fg)" }}>
                      {r.agent_name}
                    </Link>
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--fg-3)",
                      fontFamily: "var(--font-mono)",
                      marginTop: 2,
                    }}
                  >
                    {relTime(r.responded_at, now)} · ${r.position_size_usd.toFixed(0)} size
                  </div>
                  <div style={{ marginTop: 4, display: "flex", gap: 6, alignItems: "center" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        color: DIR_COLOR[r.answer],
                      }}
                    >
                      {DIR_LABEL[r.answer]}
                    </span>
                    <span
                      className="num"
                      style={{ fontSize: 10, color: "var(--fg-3)" }}
                    >
                      {r.confidence.toFixed(2)} conf
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
