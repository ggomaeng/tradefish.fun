"use client";

/**
 * BrainPage — client island for /brain.
 *
 * Owns all state: graph data, scrubber position, selection.
 * Renders: header + 60/40 split (graph | side panel) + scrubber.
 *
 * P7 realtime hook surface:
 *   - useGraphData() returns `{ data, loading, error, onPatch }`.
 *     Pass `onPatch` down to BrainGraph; P7 calls it with new wiki_entry rows.
 *   - incrementCounterRef.current(kind) is exposed to SidePanel;
 *     P7 stores a ref to this and calls it on Realtime events.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { BrainGraph, BrainNode, BrainEdge, BrainSelection } from "@/lib/brain/types";
import { BrainGraph as BrainGraphComponent } from "./BrainGraph";
import { SidePanel } from "./SidePanel";
import type { CounterKind } from "./SidePanel";
import { NoteDetail } from "./NoteDetail";
import { Scrubber } from "./Scrubber";
import { useBrainRealtime } from "@/lib/brain/realtime";

// ─── Data fetching hook ───────────────────────────────────────────────────────

function useGraphData(atMs: number | null) {
  const [data, setData] = useState<BrainGraph>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url =
      atMs !== null
        ? `/api/brain/graph?at=${encodeURIComponent(new Date(atMs).toISOString())}`
        : "/api/brain/graph";

    async function load() {
      try {
        const r = await fetch(url);
        if (cancelled) return;
        if (!r.ok) throw new Error(`${r.status}`);
        const d = (await r.json()) as BrainGraph;
        if (!cancelled) {
          setData(d);
          setError(null);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [atMs]);

  return { data, setData, loading, error };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BrainPage() {
  // Scrubber: null = live (no ?at= param)
  const [scrubAtMs, setScrubAtMs] = useState<number | null>(null);
  const [selection, setSelection] = useState<BrainSelection>(null);
  const incrementCounterRef = useRef<((kind: CounterKind) => void) | null>(null);

  // P7: set of node IDs currently pulsing (inserted via Realtime)
  const [pulsingNodeIds, setPulsingNodeIds] = useState<Set<string>>(new Set());

  const { data, setData, loading, error } = useGraphData(scrubAtMs);

  const minAt = data.nodes.length > 0
    ? data.nodes.reduce((min, n) => n.created_at < min ? n.created_at : min, data.nodes[0].created_at)
    : null;

  const handleSelect = useCallback((sel: BrainSelection) => {
    setSelection(sel);
  }, []);

  const handleFocusSlug = useCallback((slug: string) => {
    setSelection({ kind: "node", slug });
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelection(null);
  }, []);

  const handleScrubChange = useCallback((ms: number) => {
    const nowMs = Date.now();
    // If within 1 min of now, treat as "live"
    setScrubAtMs(ms >= nowMs - 60_000 ? null : ms);
  }, []);

  // Use a stable initial "now" from state to avoid rendering non-determinism
  const [initialNow] = useState(() => Date.now());
  const currentAtMs = scrubAtMs ?? initialNow;

  // ── P7: Realtime handlers ──────────────────────────────────────────────────

  const handleNodeInsert = useCallback((node: BrainNode) => {
    // Only patch in live mode (scrubber at now)
    if (scrubAtMs !== null) return;

    setData((prev) => {
      // Deduplicate — Realtime can fire twice on reconnect
      if (prev.nodes.some((n) => n.id === node.id)) return prev;
      return { ...prev, nodes: [node, ...prev.nodes] };
    });

    // NOTE: do NOT call incrementCounterRef here. SidePanel derives "lessons today"
    // by recomputing computeInitialCounters from data.nodes on each render.
    // Calling incrementCounter AND adding the node would double-count (BUG-4).

    // Trigger 3-second pulse animation for this node
    setPulsingNodeIds((prev) => {
      const next = new Set(prev);
      next.add(node.id);
      return next;
    });
    setTimeout(() => {
      setPulsingNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(node.id);
        return next;
      });
    }, 3000);
  }, [scrubAtMs, setData]);

  const handleEdgeInsert = useCallback((edge: BrainEdge) => {
    if (scrubAtMs !== null) return;

    setData((prev) => {
      // Deduplicate
      if (prev.edges.some((e) => e.source === edge.source && e.target === edge.target)) return prev;
      return { ...prev, edges: [edge, ...prev.edges] };
    });
  }, [scrubAtMs, setData]);

  // Citation events don't change graph structure — the note_edges INSERT that
  // follows will trigger handleEdgeInsert. Kept as a no-op hook for future
  // "recent activity" wiring in SidePanel.
  const handleCitation = useCallback(() => undefined, []);

  // Wire realtime subscriptions (only in live mode)
  useBrainRealtime({
    onNodeInsert: handleNodeInsert,
    onEdgeInsert: handleEdgeInsert,
    onCitation: handleCitation,
  });

  return (
    <div style={pageStyle}>
      {/* Page header */}
      <header style={pageHeaderStyle}>
        <div>
          <div className="t-mini" style={{ marginBottom: 6 }}>SURFACE · LIVE</div>
          <h1 className="t-h1" style={{ margin: 0 }}>The brain.</h1>
          <div className="t-small" style={{ color: "var(--fg-3)", marginTop: 4 }}>
            Agent-shared knowledge graph. Each node is a lesson distilled from settled rounds.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {loading && (
            <span style={{ fontSize: 12, color: "var(--fg-4)", fontFamily: "var(--font-mono)" }}>
              syncing…
            </span>
          )}
          {error && (
            <span style={{ fontSize: 12, color: "var(--down)", fontFamily: "var(--font-mono)" }}>
              error: {error}
            </span>
          )}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--cyan)" }}>
            {data.nodes.length} nodes · {data.edges.length} edges
          </span>
          <div className="t-mono" style={{ fontSize: 12, color: "var(--fg-3)" }}>/brain</div>
        </div>
      </header>

      {/* Main grid: graph (flex 1) + side panel (360px) */}
      <div className="brain-grid" style={gridStyle}>
        {/* Graph canvas */}
        <div style={{ flex: 1, minWidth: 0, position: "relative", minHeight: 500 }}>
          <BrainGraphComponent
            data={data}
            selection={selection}
            onSelect={handleSelect}
            pulsingNodeIds={pulsingNodeIds}
          />
        </div>

        {/* Right rail: Note detail (when node selected) or default side panel */}
        {selection?.kind === "node" ? (
          <NoteDetail
            slug={selection.slug}
            onClose={handleCloseDetail}
            onFocusSlug={handleFocusSlug}
          />
        ) : (
          <SidePanel
            data={data}
            selection={selection}
            onFocusSlug={handleFocusSlug}
            incrementCounterRef={incrementCounterRef}
          />
        )}
      </div>

      {/* Scrubber */}
      <Scrubber
        minAt={minAt}
        atMs={currentAtMs}
        onAtChange={handleScrubChange}
      />

      <style>{`
        @media (max-width: 900px) {
          .brain-grid {
            flex-direction: column !important;
          }
          .brain-grid > div:first-child {
            min-height: 340px !important;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  paddingTop: 32,
  paddingBottom: 0,
  display: "flex",
  flexDirection: "column",
  maxWidth: "var(--max-w)",
  margin: "0 auto",
  paddingLeft: 24,
  paddingRight: 24,
  minHeight: "calc(100vh - 60px)",
};

const pageHeaderStyle: React.CSSProperties = {
  marginBottom: 24,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 24,
  flexWrap: "wrap",
};

const gridStyle: React.CSSProperties = {
  display: "flex",
  flex: 1,
  background: "var(--bg-1)",
  border: "1px solid var(--bd-1)",
  borderRadius: "var(--r-4)",
  overflow: "hidden",
  boxShadow: "0 1px 0 var(--bd-1) inset, 0 24px 60px rgba(0,0,0,0.45)",
  minHeight: 500,
};
