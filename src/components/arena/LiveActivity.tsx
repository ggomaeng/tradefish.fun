"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  useArenaActivity,
  relativeTime,
  type ActivityEvent,
} from "@/lib/realtime/activity";
import { FishAvatar } from "@/components/avatar/FishAvatar";

type Tone = "up" | "down" | "hold" | "neutral";

interface ActivityRow {
  key: string;
  ts: string;
  who: string;
  msg: string;
  pos: string;
  tone: Tone;
  conf?: number;
  pnl?: string;
  pnlTone?: "up" | "down";
}

function dirToLabel(d: "buy" | "sell" | "hold"): string {
  return d === "buy" ? "▲ LONG" : d === "sell" ? "▼ SHORT" : "· HOLD";
}
function dirToTone(d: "buy" | "sell" | "hold"): Tone {
  return d === "buy" ? "up" : d === "sell" ? "down" : "hold";
}

function eventToRow(e: ActivityEvent, i: number): ActivityRow {
  const tsRel = relativeTime(e.ts);
  if (e.kind === "predict") {
    return {
      key: `p-${i}-${e.ts}-${e.who}`,
      ts: tsRel,
      who: e.who,
      msg: e.token,
      pos: dirToLabel(e.dir),
      tone: dirToTone(e.dir),
      conf: e.conf,
    };
  }
  if (e.kind === "settle") {
    const sign = e.pnl >= 0 ? "+" : "−";
    return {
      key: `s-${i}-${e.ts}-${e.who}`,
      ts: tsRel,
      who: e.who,
      msg: `settled ${e.token}`,
      pos: dirToLabel(e.dir),
      tone: dirToTone(e.dir),
      pnl: `${sign}$${Math.abs(e.pnl).toFixed(2)}`,
      pnlTone: e.pnl >= 0 ? "up" : "down",
    };
  }
  return {
    key: `c-${i}-${e.ts}-${e.who}`,
    ts: tsRel,
    who: e.who,
    msg: "agent claimed",
    pos: "JOIN",
    tone: "neutral",
  };
}

export function LiveActivity() {
  const { events, loading } = useArenaActivity();
  const [, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const rows = events.map(eventToRow);
  const empty = !loading && rows.length === 0;

  return (
    <aside
      style={{
        background: "var(--bg-1)",
        borderLeft: "1px solid var(--line)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        height: "100%",
        minHeight: 540,
      }}
    >
      <div
        className="card-head"
        style={{
          margin: 0,
          padding: "10px 16px",
        }}
      >
        <span>┌─ LIVE ACTIVITY</span>
        <span className="chip chip-live">
          <span className="dot" />
          {loading ? "SYNC" : "LIVE"}
        </span>
      </div>
      <div
        style={{ flex: 1, overflowY: "auto" }}
        aria-live="polite"
        aria-atomic="false"
        className="no-scrollbar"
      >
        {empty ? (
          <div
            style={{
              padding: "40px 16px",
              textAlign: "center",
              fontSize: 13,
              color: "var(--fg-faint)",
            }}
          >
            No activity yet. Standing by.
            <br />
            <span
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--fg-faintest)",
              }}
            >
              Open a round at{" "}
              <Link href="/ask" style={{ color: "var(--cyan)" }}>
                /ask
              </Link>
            </span>
          </div>
        ) : (
          rows.map((row) => {
            // Map row tone → event-type accent for the 4px left bar.
            const evColor =
              row.tone === "up"
                ? "var(--ev-settle)"
                : row.tone === "down"
                  ? "var(--ev-change)"
                  : row.tone === "hold"
                    ? "var(--hold)"
                    : "var(--ev-fire)";
            return (
              <div
                key={row.key}
                style={{
                  padding: "12px 16px 12px 13px",
                  borderBottom: "1px solid var(--line)",
                  borderLeft: `4px solid ${evColor}`,
                  display: "grid",
                  gridTemplateColumns: "28px 1fr",
                  gap: 10,
                }}
              >
                <FishAvatar shortId={null} nameFallback={row.who} size={28} />
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--fg)",
                    }}
                  >
                    {row.who}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--fg-3)",
                      marginTop: 2,
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    <span className="num">{row.ts}</span>
                    {row.conf !== undefined && (
                      <>
                        <span>·</span>
                        <span>{row.conf.toFixed(2)} conf</span>
                      </>
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      className={
                        row.tone === "up"
                          ? "chip chip-up"
                          : row.tone === "down"
                            ? "chip chip-down"
                            : row.tone === "hold"
                              ? "chip chip-hold"
                              : "chip"
                      }
                    >
                      {row.pos}
                    </span>
                    <span style={{ color: "var(--fg-3)" }}>{row.msg}</span>
                    {row.pnl && (
                      <span
                        className="num"
                        style={{
                          color:
                            row.pnlTone === "up" ? "var(--up)" : "var(--down)",
                          marginLeft: "auto",
                        }}
                      >
                        {row.pnl}
                      </span>
                    )}
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
