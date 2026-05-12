"use client";

import { useEffect, useState } from "react";
import { useArenaActivity, relativeTime, type ActivityEvent } from "@/lib/realtime/activity";

type Tone = "up" | "down" | "hold" | "neutral";

interface ActivityRow {
  key: string;
  ts: string;
  who: string;
  initials: string;
  avClass: string;
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
function initialsOf(name: string): string {
  const parts = name.replace(/[^a-zA-Z\s]/g, "").trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
function avClassFor(tone: Tone): string {
  if (tone === "up") return "av green";
  if (tone === "down") return "av red";
  return "av";
}

function eventToRow(e: ActivityEvent, i: number): ActivityRow {
  const tsRel = relativeTime(e.ts);
  if (e.kind === "predict") {
    const tone = dirToTone(e.dir);
    return {
      key: `p-${i}-${e.ts}-${e.who}`,
      ts: tsRel,
      who: e.who,
      initials: initialsOf(e.who),
      avClass: avClassFor(tone),
      msg: e.token,
      pos: dirToLabel(e.dir),
      tone,
      conf: e.conf,
    };
  }
  if (e.kind === "settle") {
    const tone = dirToTone(e.dir);
    const sign = e.pnl >= 0 ? "+" : "−";
    return {
      key: `s-${i}-${e.ts}-${e.who}`,
      ts: tsRel,
      who: e.who,
      initials: initialsOf(e.who),
      avClass: avClassFor(tone),
      msg: `settled ${e.token}`,
      pos: dirToLabel(e.dir),
      tone,
      pnl: `${sign}$${Math.abs(e.pnl).toFixed(2)}`,
      pnlTone: e.pnl >= 0 ? "up" : "down",
    };
  }
  return {
    key: `c-${i}-${e.ts}-${e.who}`,
    ts: tsRel,
    who: e.who,
    initials: initialsOf(e.who),
    avClass: "av",
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
        borderLeft: "1px solid var(--bd-1)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        height: "100%",
        minHeight: 540,
      }}
    >
      <div
        style={{
          padding: 16,
          borderBottom: "1px solid var(--bd-1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h4 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Activity feed</h4>
        <span className="chip chip-live">
          <span className="dot" />
          {loading ? "SYNC" : "LIVE"}
        </span>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }} aria-live="polite" aria-atomic="false" className="no-scrollbar">
        {empty ? (
          <div style={{ padding: "40px 16px", textAlign: "center", fontSize: 13, color: "var(--fg-3)" }}>
            No activity yet.<br />
            Open a round at <span style={{ color: "var(--cyan)" }}>/ask</span>.
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.key}
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--bd-1)",
                display: "grid",
                gridTemplateColumns: "28px 1fr",
                gap: 10,
              }}
            >
              <div className={row.avClass}>{row.initials}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)" }}>
                  {row.who}
                </div>
                <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 2, display: "flex", gap: 6, alignItems: "center" }}>
                  <span className="num">{row.ts}</span>
                  {row.conf !== undefined && (
                    <>
                      <span>·</span>
                      <span>{row.conf.toFixed(2)} conf</span>
                    </>
                  )}
                </div>
                <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6, fontSize: 12, flexWrap: "wrap" }}>
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
                      style={{ color: row.pnlTone === "up" ? "var(--up)" : "var(--down)", marginLeft: "auto" }}
                    >
                      {row.pnl}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
