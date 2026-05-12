"use client";

/**
 * SidePanel — right rail on /brain.
 *
 * Three subsections:
 *  1. Top Tokens     — top 5 by cite_count over the last 7 days
 *  2. Live Counters  — lessons today, rounds settled today, agents active today
 *  3. Recent Ingest  — last 10 nodes by created_at desc, click to focus
 *
 * P7 hook surface:
 *   - Call `incrementCounter(kind)` to tick a counter with a brief flash.
 *     Export `useBrainCounters` to let P7 wire in Realtime events.
 */

import React, { useMemo, useState, useCallback, useEffect } from "react";
import type { BrainNode, BrainGraph, BrainSelection } from "@/lib/brain/types";

// ─── Counter hook (P7 entry point) ───────────────────────────────────────────

export type CounterKind = "lesson" | "round" | "agent";

interface Counters {
  lesson: number;
  round: number;
  agent: number;
}

interface CounterFlash {
  lesson: boolean;
  round: boolean;
  agent: boolean;
}

/**
 * useBrainCounters — exposes incrementCounter for P7 to call on Realtime events.
 * Initial values are derived from graph data in SidePanel, but can be bumped.
 */
export function useBrainCounters(initial: Counters) {
  // delta tracks increments from Realtime events layered on top of initial
  const [delta, setDelta] = useState<Counters>({ lesson: 0, round: 0, agent: 0 });
  const [flash, setFlash] = useState<CounterFlash>({ lesson: false, round: false, agent: false });

  const counters: Counters = {
    lesson: initial.lesson + delta.lesson,
    round: initial.round + delta.round,
    agent: initial.agent + delta.agent,
  };

  const incrementCounter = useCallback((kind: CounterKind) => {
    setDelta((prev) => ({ ...prev, [kind]: prev[kind] + 1 }));
    setFlash((prev) => ({ ...prev, [kind]: true }));
    setTimeout(() => setFlash((prev) => ({ ...prev, [kind]: false })), 700);
  }, []);

  return { counters, flash, incrementCounter };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function computeTopTokens(nodes: BrainNode[], limit = 5): Array<{ token: string; cite_count: number }> {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const tally = new Map<string, number>();
  for (const node of nodes) {
    if (new Date(node.created_at).getTime() < cutoff) continue;
    for (const t of node.tokens) {
      tally.set(t, (tally.get(t) ?? 0) + node.cite_count + 1);
    }
  }
  return Array.from(tally.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token, cite_count]) => ({ token, cite_count }));
}

function computeInitialCounters(nodes: BrainNode[]): Counters {
  const todayNodes = nodes.filter((n) => isToday(n.created_at));
  const agentSet = new Set(nodes.filter((n) => isToday(n.created_at) && n.author_agent_id).map((n) => n.author_agent_id));
  return {
    lesson: todayNodes.length,
    round: 0,   // settlement data not in graph endpoint — P7 wires from Realtime
    agent: agentSet.size,
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SidePanelProps {
  data: BrainGraph;
  selection: BrainSelection;
  onFocusSlug: (slug: string) => void;
  /** P7: incrementCounter entry point — exposed so Realtime events can tick */
  incrementCounterRef?: React.MutableRefObject<((kind: CounterKind) => void) | null>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SidePanel({ data, selection, onFocusSlug, incrementCounterRef }: SidePanelProps) {
  const topTokens = useMemo(() => computeTopTokens(data.nodes), [data.nodes]);
  const recentNodes = useMemo(
    () => [...data.nodes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10),
    [data.nodes]
  );
  const initialCounters = useMemo(() => computeInitialCounters(data.nodes), [data.nodes]);
  const { counters, flash, incrementCounter } = useBrainCounters(initialCounters);

  // Expose incrementCounter for P7
  useEffect(() => {
    if (incrementCounterRef) {
      incrementCounterRef.current = incrementCounter;
    }
  }, [incrementCounter, incrementCounterRef]);

  const selectedSlug = selection?.kind === "node" ? selection.slug : null;

  return (
    <aside style={asideStyle}>
      {/* ── 1. Top tokens ─────────────────────────────────── */}
      <section style={sectionStyle}>
        <h4 style={sectionHeadStyle}>TOP TOKENS · 7D</h4>
        {topTokens.length === 0 ? (
          <div style={emptyStyle}>No token data yet</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 16px 12px" }}>
            {topTokens.map(({ token }) => (
              <button
                key={token}
                className="chip"
                style={{ cursor: "pointer" }}
                onClick={() => {
                  // Filter graph to nodes containing this token — P7 can wire into graph filter
                }}
              >
                {token}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── 2. Live counters ──────────────────────────────── */}
      <section style={sectionStyle}>
        <h4 style={sectionHeadStyle}>LIVE</h4>
        <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
          <CounterRow
            icon="+"
            value={counters.lesson}
            label="lessons today"
            flash={flash.lesson}
            iconColor="var(--up)"
          />
          <CounterRow
            icon="◎"
            value={counters.round}
            label="rounds settled today"
            flash={flash.round}
            iconColor="var(--cyan)"
          />
          <CounterRow
            icon="⬡"
            value={counters.agent}
            label="agents active today"
            flash={flash.agent}
            iconColor="var(--hold)"
          />
        </div>
      </section>

      {/* ── 3. Recent ingest feed ─────────────────────────── */}
      <section style={{ ...sectionStyle, flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <h4 style={sectionHeadStyle}>RECENT INGEST</h4>
        <div style={{ flex: 1, overflowY: "auto" }} className="no-scrollbar">
          {recentNodes.length === 0 ? (
            <div style={{ ...emptyStyle, padding: "16px" }}>No notes yet</div>
          ) : (
            recentNodes.map((node) => (
              <IngestRow
                key={node.id}
                node={node}
                active={node.id === selectedSlug}
                onFocus={() => onFocusSlug(node.id)}
              />
            ))
          )}
        </div>
      </section>
    </aside>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CounterRow({
  icon,
  value,
  label,
  flash,
  iconColor,
}: {
  icon: string;
  value: number;
  label: string;
  flash: boolean;
  iconColor: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: iconColor,
          width: 16,
          textAlign: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--t-h2)",
          fontWeight: 600,
          color: flash ? "var(--cyan)" : "var(--fg)",
          transition: "color 200ms ease",
          minWidth: 36,
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 12, color: "var(--fg-3)" }}>{label}</span>
    </div>
  );
}

function IngestRow({
  node,
  active,
  onFocus,
}: {
  node: BrainNode;
  active: boolean;
  onFocus: () => void;
}) {
  const pnlSign = node.pnl_usd >= 0 ? "+" : "−";
  const pnlAbs = Math.abs(node.pnl_usd);
  const hasPnl = pnlAbs > 0;

  return (
    <button
      onClick={onFocus}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "10px 16px",
        borderBottom: "1px solid var(--bd-1)",
        background: active ? "var(--bg-3)" : "transparent",
        border: "none",
        cursor: "pointer",
        transition: "background 150ms ease",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = "var(--bg-2)";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", lineHeight: 1.3, marginBottom: 4 }}>
        {node.title}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {node.tokens.slice(0, 3).map((t) => (
          <span key={t} className="chip" style={{ fontSize: 10, padding: "1px 6px" }}>
            {t}
          </span>
        ))}
        {hasPnl && (
          <span
            style={{
              marginLeft: "auto",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: node.pnl_usd >= 0 ? "var(--up)" : "var(--down)",
            }}
          >
            {pnlSign}${pnlAbs >= 1000 ? `${(pnlAbs / 1000).toFixed(1)}k` : pnlAbs.toFixed(0)}
          </span>
        )}
        <span style={{ fontSize: 10, color: "var(--fg-4)", marginLeft: hasPnl ? 0 : "auto" }}>
          {relativeTime(node.created_at)}
        </span>
      </div>
    </button>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const asideStyle: React.CSSProperties = {
  width: 360,
  flexShrink: 0,
  background: "var(--bg-1)",
  borderLeft: "1px solid var(--bd-1)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  height: "100%",
};

const sectionStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--bd-1)",
};

const sectionHeadStyle: React.CSSProperties = {
  fontSize: "var(--t-mini)",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--fg-3)",
  margin: 0,
  padding: "12px 16px 8px",
};

const emptyStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--fg-4)",
  padding: "8px 16px 12px",
};
