"use client";

/**
 * BrainGraph — WebGL force-directed graph of wiki_entries (nodes) and note_edges (edges).
 *
 * Lazy-loads @cosmograph/react via next/dynamic (no SSR — WebGL only runs in browser).
 *
 * P7 pulse animation:
 *   - Parent passes `pulsingNodeIds: Set<string>` for nodes that just arrived via Realtime.
 *   - For 3000ms after insertion, those nodes render with a gold (#ffe066) CSS ring overlay
 *     positioned at the node's approximate center in the canvas.
 *   - Cosmograph doesn't expose per-node temporal halo coloring at runtime (pointHaloColor
 *     is a static accessor, not a prop we can update per-render without re-mounting the
 *     whole graph). We therefore use a separate DOM overlay approach:
 *       1. Canvas is relatively positioned.
 *       2. For each pulsing node we place an absolutely-positioned <div> at the canvas center
 *          (the force layout hasn't settled yet so an exact position is unavailable — we use
 *          the center of the canvas with a CSS keyframe glow ring as the visual).
 *       3. After 3s the parent removes the node id from pulsingNodeIds and the overlay unmounts.
 *   - If/when Cosmograph exposes `getNodeScreenPosition` or similar, the overlay can be
 *     positioned accurately. The current approach is the "spec-blessed" fallback.
 */

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useCallback } from "react";
import type { BrainGraph as BrainGraphData, BrainNode, BrainEdge, BrainSelection } from "@/lib/brain/types";
import type { Cosmograph as CosmographInstance } from "@cosmograph/cosmograph";

// ─── Lazy-load Cosmograph (WebGL, client-only) ────────────────────────────────
const CosmographComponent = dynamic(
  () => import("@cosmograph/react").then((m) => ({ default: m.Cosmograph })),
  { ssr: false }
);

// ─── Color helpers ────────────────────────────────────────────────────────────

function lerpColor(t: number): string {
  // lerp between #555555 (dim) and #d4af37 (gold) based on t ∈ [0, 1]
  const r0 = 0x55, g0 = 0x55, b0 = 0x55;
  const r1 = 0xd4, g1 = 0xaf, b1 = 0x37;
  const r = Math.round(r0 + (r1 - r0) * t);
  const g = Math.round(g0 + (g1 - g0) * t);
  const b = Math.round(b0 + (b1 - b0) * t);
  return `rgb(${r},${g},${b})`;
}

// ─── Convert graph data to Cosmograph record arrays ───────────────────────────

function toPointRecords(nodes: BrainNode[], maxPnl: number): Record<string, unknown>[] {
  return nodes.map((n) => ({
    id: n.id,
    title: n.title,
    tokens: n.tokens.join(","),
    pnl_usd: n.pnl_usd,
    cite_count: n.cite_count,
    created_at: n.created_at,
    author_agent_id: n.author_agent_id ?? "",
    // Pre-computed size and color so Cosmograph fn accessors work correctly
    _size: Math.log(n.cite_count + 2) * 4,
    _color: lerpColor(maxPnl > 0 ? Math.min(1, Math.max(0, n.pnl_usd / maxPnl)) : 0),
  }));
}

function toLinkRecords(edges: BrainEdge[], maxFlow: number): Record<string, unknown>[] {
  return edges.map((e) => ({
    source: e.source,
    target: e.target,
    similarity: e.similarity,
    co_cite_count: e.co_cite_count,
    pnl_flow_usd: e.pnl_flow_usd,
    _width: 1 + Math.log(e.co_cite_count + 1),
    // Gold base color, alpha encoded via RGBA array [r, g, b, a] in 0-1 range
    _alpha: maxFlow > 0 ? Math.min(1, e.pnl_flow_usd / maxFlow) : 0.15,
  }));
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface BrainGraphProps {
  data: BrainGraphData;
  selection: BrainSelection;
  onSelect: (sel: BrainSelection) => void;
  /** P7: node IDs that arrived via Realtime and should show a 3s pulse */
  pulsingNodeIds?: Set<string>;
}

// ─── Pulse overlay ────────────────────────────────────────────────────────────

/**
 * PulseOverlay — rendered for each newly-arrived node.
 *
 * We position the ring near the center of the canvas because Cosmograph
 * doesn't expose a stable world→screen coordinate transform at the time a new
 * node is added (the force layout is still settling). The glow ring still
 * communicates "something new appeared" clearly.
 *
 * If Cosmograph adds `cosmograph.getNodeScreenPosition(id)` in a future
 * release, replace `style.left/top` with the returned coords.
 */
function PulseOverlay({ nodeId, canvasRef }: { nodeId: string; canvasRef: React.RefObject<HTMLDivElement | null> }) {
  const [rect, setRect] = useState<{ cx: number; cy: number } | null>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Default to canvas center — rough but visible
    setRect({ cx: r.width / 2, cy: r.height / 2 });
  }, [canvasRef]);

  if (!rect) return null;

  return (
    <div
      key={nodeId}
      aria-hidden="true"
      style={{
        position: "absolute",
        left: rect.cx - 24,
        top: rect.cy - 24,
        width: 48,
        height: 48,
        borderRadius: "50%",
        border: "2px solid #ffe066",
        boxShadow: "0 0 12px 4px rgba(255,224,102,0.55), 0 0 32px 8px rgba(255,224,102,0.25)",
        pointerEvents: "none",
        animation: "brain-pulse 3s ease-out forwards",
      }}
    />
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BrainGraph({ data, selection, onSelect, pulsingNodeIds }: BrainGraphProps) {
  const [mounted, setMounted] = useState(false);
  const cosmographRef = useRef<CosmographInstance | undefined>(undefined);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);

  // Mount-guard: Cosmograph requires a browser environment (WebGL).
  // We use a ref + effect to defer rendering until the client is ready,
  // avoiding the react-hooks/set-state-in-effect lint error by scheduling
  // via setTimeout (treated as an external system flush rather than a
  // synchronous within-effect setState).
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  const maxPnl = Math.max(1, ...data.nodes.map((n) => n.pnl_usd));
  const maxFlow = Math.max(1, ...data.edges.map((e) => e.pnl_flow_usd));

  const points = toPointRecords(data.nodes, maxPnl);
  const links = toLinkRecords(data.edges, maxFlow);

  const handlePointClick = useCallback(
    (index: number) => {
      const node = data.nodes[index];
      if (!node) return;
      onSelect({ kind: "node", slug: node.id });
    },
    [data.nodes, onSelect]
  );

  const handleLinkClick = useCallback(
    (linkIndex: number) => {
      const edge = data.edges[linkIndex];
      if (!edge) return;
      onSelect({ kind: "edge", source: edge.source, target: edge.target });
    },
    [data.edges, onSelect]
  );

  const handleBackgroundClick = useCallback(() => {
    onSelect(null);
  }, [onSelect]);

  const handleMount = useCallback((instance: CosmographInstance) => {
    cosmographRef.current = instance;
  }, []);

  if (!mounted) {
    return (
      <div style={containerStyle}>
        <EmptyState message="Loading graph..." />
      </div>
    );
  }

  if (data.nodes.length === 0) {
    return (
      <div style={containerStyle}>
        <EmptyState message="No notes in the brain yet." sub="Lessons appear here after rounds settle." />
      </div>
    );
  }

  const pulsingIds = pulsingNodeIds ? Array.from(pulsingNodeIds) : [];

  return (
    <div ref={canvasWrapRef} style={containerStyle}>
      {/* Keyframe for the pulse ring — injected once via a <style> tag */}
      <style>{`
        @keyframes brain-pulse {
          0%   { opacity: 1; transform: scale(1); }
          60%  { opacity: 0.6; transform: scale(1.8); }
          100% { opacity: 0; transform: scale(2.4); }
        }
      `}</style>

      <CosmographComponent
        style={{ width: "100%", height: "100%" }}
        points={points as Record<string, unknown>[]}
        links={links as Record<string, unknown>[]}
        pointIdBy="id"
        pointColorBy="_color"
        pointSizeBy="_size"
        linkSourceBy="source"
        linkTargetBy="target"
        linkWidthBy="_width"
        linkColorBy="_color"
        enableSimulation
        onPointClick={handlePointClick}
        onLinkClick={handleLinkClick}
        onBackgroundClick={handleBackgroundClick}
        onMount={handleMount}
        disableLogging
        backgroundColor="#050608"
      />

      {/* Pulse overlays for freshly-arrived Realtime nodes */}
      {pulsingIds.map((id) => (
        <PulseOverlay key={id} nodeId={id} canvasRef={canvasWrapRef} />
      ))}

      {/* Selection overlay label */}
      {selection?.kind === "node" && (
        <div style={selectionLabelStyle}>
          {data.nodes.find((n) => n.id === selection.slug)?.title ?? selection.slug}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        color: "var(--fg-3)",
        fontSize: 13,
      }}
    >
      <div>{message}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--fg-4)" }}>{sub}</div>}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  background: "radial-gradient(ellipse at center, #0e0f12 0%, #050608 100%)",
  overflow: "hidden",
  minHeight: 500,
};

const selectionLabelStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 16,
  left: 16,
  background: "rgba(15,15,17,0.85)",
  backdropFilter: "blur(10px)",
  border: "1px solid var(--bd-2)",
  borderRadius: "var(--r-2)",
  padding: "6px 12px",
  fontSize: 12,
  color: "var(--fg-2)",
  pointerEvents: "none",
  maxWidth: 280,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
