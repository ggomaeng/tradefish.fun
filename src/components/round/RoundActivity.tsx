"use client";

/**
 * RoundActivity — right-sidebar live feed for a single round.
 *
 * For open rounds: subscribes to Supabase Realtime for new responses
 * + settlements via useRoundActivity(), merging with SSR initial data.
 *
 * For closed rounds: static render of the passed responses.
 *
 * Shows settlement PnL deltas and direction changes in a compact feed.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRoundActivity, type RoundResponse, type RoundSettlement } from "@/lib/realtime/round";

const DIR_LABEL = { buy: "▲ LONG", sell: "▼ SHORT", hold: "· HOLD" } as const;
const DIR_COLOR = { buy: "var(--up)", sell: "var(--down)", hold: "var(--hold)" } as const;

interface Props {
  queryId: string;
  isOpen: boolean;
  initialResponses: RoundResponse[];
  initialSettlements: RoundSettlement[];
}

function relTime(iso: string, nowMs: number): string {
  const diff = Math.max(0, nowMs - new Date(iso).getTime());
  if (diff < 5_000) return "now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function RoundActivity({ queryId, isOpen, initialResponses, initialSettlements }: Props) {
  const { responses, settlements } = useRoundActivity(queryId, initialResponses, initialSettlements);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  // Build a unified event list: responses + settlements sorted by time desc
  type FeedItem =
    | { kind: "response"; r: RoundResponse }
    | { kind: "settlement"; s: RoundSettlement; r: RoundResponse };

  const items: FeedItem[] = [];

  // Settlements first (most recent activity)
  const responseMap = new Map(responses.map((r) => [r.id, r]));
  for (const s of settlements) {
    const r = responseMap.get(s.response_id);
    if (r) items.push({ kind: "settlement", s, r });
  }

  // All responses
  for (const r of responses) {
    items.push({ kind: "response", r });
  }

  // Sort by timestamp desc
  items.sort((a, b) => {
    const tsA = a.kind === "settlement" ? a.s.settled_at : a.r.responded_at;
    const tsB = b.kind === "settlement" ? b.s.settled_at : b.r.responded_at;
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
        ) : (
          <span className="chip">SETTLED</span>
        )}
      </div>

      {/* Feed */}
      <div
        style={{ flex: 1, overflowY: "auto" }}
        aria-live={isOpen ? "polite" : "off"}
        aria-atomic="false"
        className="no-scrollbar"
      >
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
          items.map((item, i) => {
            if (item.kind === "settlement") {
              const { s, r } = item;
              const sign = s.pnl_pct >= 0 ? "+" : "";
              const pnlColor = s.pnl_pct >= 0 ? "var(--up)" : "var(--down)";
              return (
                <div
                  key={`s-${s.response_id}-${s.horizon}`}
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
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                      }}
                    >
                      <span>{relTime(s.settled_at, now)}</span>
                      <span>·</span>
                      <span>{s.horizon} settle</span>
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
                        style={{ fontSize: 11, color: pnlColor, marginLeft: "auto" }}
                      >
                        {sign}{s.pnl_pct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            // Response row
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
                    {relTime(r.responded_at, now)}
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
