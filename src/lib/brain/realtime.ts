"use client";

/**
 * useBrainRealtime — Supabase Realtime subscription for the Brain feature.
 *
 * Subscribes to INSERT events on:
 *   - wiki_entries      → onNodeInsert
 *   - note_edges        → onEdgeInsert
 *   - answer_citations  → onCitation
 *
 * All three tables are in supabase_realtime publication (migration 0011_brain.sql).
 *
 * Usage:
 *   useBrainRealtime({ onNodeInsert, onEdgeInsert, onCitation })
 *
 * Returns nothing — cleanup is internal via the subscription's unsubscribe().
 * Call this hook once from the top-level client component; it manages its own
 * lifecycle via useEffect.
 */

import { useEffect } from "react";
import { dbBrowser } from "@/lib/db";
import type { BrainNode, BrainEdge } from "./types";

// ── Raw DB row shapes coming from Realtime payloads ─────────────────────────

interface WikiEntryRow {
  slug: string;
  title: string;
  tokens: string[] | null;
  pnl_attributed_usd: number | null;
  cite_count: number | null;
  created_at: string | null;
  author_agent_id: string | null;
}

interface NoteEdgeRow {
  from_slug: string;
  to_slug: string;
  similarity: number;
  co_cite_count: number | null;
  pnl_flow_usd: number | null;
}

interface AnswerCitationRow {
  answer_id: string;
  slug: string;
  source: string;
  weight: number;
}

// ── Converters from DB row → typed graph item ────────────────────────────────

function rowToNode(row: WikiEntryRow): BrainNode {
  return {
    id: row.slug,
    title: row.title,
    tokens: row.tokens ?? [],
    pnl_usd: Number(row.pnl_attributed_usd ?? 0),
    cite_count: Number(row.cite_count ?? 0),
    created_at: row.created_at ?? new Date().toISOString(),
    author_agent_id: row.author_agent_id ?? null,
  };
}

function rowToEdge(row: NoteEdgeRow): BrainEdge {
  return {
    source: row.from_slug,
    target: row.to_slug,
    similarity: Number(row.similarity ?? 0),
    co_cite_count: Number(row.co_cite_count ?? 0),
    pnl_flow_usd: Number(row.pnl_flow_usd ?? 0),
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface BrainRealtimeHandlers {
  onNodeInsert: (node: BrainNode) => void;
  onEdgeInsert: (edge: BrainEdge) => void;
  onCitation: (citation: AnswerCitationRow) => void;
}

export function useBrainRealtime({
  onNodeInsert,
  onEdgeInsert,
  onCitation,
}: BrainRealtimeHandlers): void {
  useEffect(() => {
    const client = dbBrowser();

    const channel = client
      .channel("brain-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "wiki_entries" },
        (payload: { new: WikiEntryRow }) => {
          const node = rowToNode(payload.new);
          onNodeInsert(node);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "note_edges" },
        (payload: { new: NoteEdgeRow }) => {
          const edge = rowToEdge(payload.new);
          onEdgeInsert(edge);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "answer_citations" },
        (payload: { new: AnswerCitationRow }) => {
          onCitation(payload.new);
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
    // Handlers passed in are stable useCallback refs from BrainPage — intentionally
    // listed here so the channel is only set up once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
