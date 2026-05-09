"use client";

/**
 * LiveActivity — scrolling event feed for the arena (REAL data).
 *
 * v2 port of v1's LiveActivity — now wired to Supabase Realtime via
 * `useArenaActivity()`. Renders predict / settle / claim events. Markup
 * + visual chrome unchanged from the prior mock version (.tf-term /
 * .tf-term-head / .tf-dir-* / spectrum tokens) so the design system
 * stays locked.
 */

import { useEffect, useState } from "react";
import { useArenaActivity, relativeTime, type ActivityEvent } from "@/lib/realtime/activity";

interface ActivityRow {
  key: string;
  ts: string;
  who: string;
  marker: "✓" | "▸" | "◉" | "＋";
  msg: string;
  pos: string;
  posCls: "long" | "short" | "hold" | "";
  pnl: string;
  pnlCls: "up" | "down" | "";
  rawTs: string;
}

function dirToCls(d: "buy" | "sell" | "hold"): "long" | "short" | "hold" {
  return d === "buy" ? "long" : d === "sell" ? "short" : "hold";
}
function dirToLabel(d: "buy" | "sell" | "hold"): string {
  return d === "buy" ? "LONG" : d === "sell" ? "SHORT" : "HOLD";
}

function eventToRow(e: ActivityEvent, i: number): ActivityRow {
  const tsRel = relativeTime(e.ts);
  if (e.kind === "predict") {
    return {
      key: `p-${i}-${e.ts}-${e.who}`,
      ts: tsRel,
      who: e.who.toUpperCase(),
      marker: "✓",
      msg: `${dirToLabel(e.dir)} ${e.token} · conf ${(e.conf * 100).toFixed(0)}%`,
      pos: dirToLabel(e.dir),
      posCls: dirToCls(e.dir),
      pnl: "—",
      pnlCls: "",
      rawTs: e.ts,
    };
  }
  if (e.kind === "settle") {
    const sign = e.pnl >= 0 ? "+" : "−";
    const abs = Math.abs(e.pnl).toFixed(2);
    return {
      key: `s-${i}-${e.ts}-${e.who}`,
      ts: tsRel,
      who: e.who.toUpperCase(),
      marker: "◉",
      msg: `settled ${dirToLabel(e.dir)} ${e.token} @ ${e.horizon}`,
      pos: dirToLabel(e.dir),
      posCls: dirToCls(e.dir),
      pnl: `${sign}${abs}%`,
      pnlCls: e.pnl >= 0 ? "up" : "down",
      rawTs: e.ts,
    };
  }
  return {
    key: `c-${i}-${e.ts}-${e.who}`,
    ts: tsRel,
    who: e.who.toUpperCase(),
    marker: "＋",
    msg: `agent claimed`,
    pos: "JOIN",
    posCls: "",
    pnl: "",
    pnlCls: "",
    rawTs: e.ts,
  };
}

export function LiveActivity() {
  const { events, loading } = useArenaActivity();
  // Re-render every 10s so relative timestamps tick without subscribing
  // to a 1s timer (which would be wasteful).
  const [, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const rows = events.map(eventToRow);
  const empty = !loading && rows.length === 0;

  return (
    <div className="tf-term">
      <div className="tf-term-head">
        <span>
          <span className="dots" style={{ display: "inline-flex", gap: "5px", marginRight: "10px" }}>
            <span /> <span /> <span />
          </span>
          ACTIVITY · LIVE FEED
        </span>
        <span className="tf-live">{loading ? "syncing…" : "LIVE"}</span>
      </div>
      <div
        className="tf-term-body"
        aria-live="polite"
        aria-atomic="false"
        style={{ padding: 0 }}
      >
        {empty ? (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--t-small)",
              color: "var(--fg-faint)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ▸ NO ACTIVITY — open a round at /ask
          </div>
        ) : (
          <div role="table">
            {rows.map((row, i) => (
              <div
                key={row.key}
                role="row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "64px 18px 110px 1fr 110px 80px",
                  gap: "10px",
                  padding: "10px 16px",
                  borderTop: i === 0 ? "none" : "1px dashed var(--line)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--t-small)",
                  alignItems: "center",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span style={{ color: "var(--fg-faint)" }}>{row.ts}</span>
                <span
                  aria-hidden="true"
                  style={{
                    color:
                      row.marker === "◉"
                        ? "var(--mint)"
                        : row.marker === "▸"
                          ? "var(--cyan)"
                          : row.marker === "＋"
                            ? "var(--violet)"
                            : "var(--fg-dim)",
                  }}
                >
                  {row.marker}
                </span>
                <span
                  style={{
                    color: "var(--fg)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.who}
                </span>
                <span
                  style={{
                    color: "var(--fg-dim)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.msg}
                </span>
                <span
                  className={
                    row.posCls === "long"
                      ? "tf-dir-long"
                      : row.posCls === "short"
                        ? "tf-dir-short"
                        : row.posCls === "hold"
                          ? "tf-dir-hold"
                          : ""
                  }
                  style={{
                    fontFamily: "var(--font-pixel)",
                    letterSpacing: "0.16em",
                    textAlign: "right",
                    color:
                      row.posCls === "long"
                        ? "var(--long)"
                        : row.posCls === "short"
                          ? "var(--short)"
                          : row.posCls === "hold"
                            ? "var(--hold)"
                            : "var(--fg-faint)",
                  }}
                >
                  {row.pos}
                </span>
                <span
                  style={{
                    color:
                      row.pnlCls === "up"
                        ? "var(--long)"
                        : row.pnlCls === "down"
                          ? "var(--short)"
                          : "var(--fg-faint)",
                    textAlign: "right",
                  }}
                >
                  {row.pnl || "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
