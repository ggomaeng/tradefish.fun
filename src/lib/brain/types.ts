/**
 * Shared TypeScript types for the Brain graph feature.
 * These mirror the API contracts served by /api/brain/graph, /api/brain/note/:slug,
 * and /api/brain/retrieval/:id.
 */

// ─── Graph API ──────────────────────────────────────────────────────────────

export interface BrainNode {
  id: string;             // = slug
  title: string;
  tokens: string[];
  pnl_usd: number;
  cite_count: number;
  created_at: string;     // ISO 8601
  author_agent_id: string | null;
}

export interface BrainEdge {
  source: string;         // from_slug
  target: string;         // to_slug
  similarity: number;
  co_cite_count: number;
  pnl_flow_usd: number;
}

export interface BrainGraph {
  nodes: BrainNode[];
  edges: BrainEdge[];
}

// ─── Note detail API ─────────────────────────────────────────────────────────

export interface BrainNoteRelated {
  slug: string;
  co_cite_count: number;
  similarity: number;
  pnl_flow_usd: number;
}

export interface BrainNoteDetail {
  note: {
    slug: string;
    title: string;
    content: string;
    tokens: string[];
    tags: string[];
    pnl_attributed_usd: number;
    cite_count: number;
    created_at: string;
    author_agent_id: string | null;
    source_round_id: string | null;
  };
  related_notes: BrainNoteRelated[];
  recent_answers: Array<{
    answer_id: string;
    source: string;
    weight: number;
    response: unknown;
  }>;
}

// ─── Retrieval API ───────────────────────────────────────────────────────────

export interface BrainRetrieval {
  retrieval: {
    id: string;
    agent_id: string | null;
    query_text: string;
    slugs: string[];
    created_at: string;
  };
  agent: unknown;
  linked_answers: unknown[];
}

// ─── Selection state (shared between graph + side panel) ────────────────────

export type BrainSelection =
  | { kind: "node"; slug: string }
  | { kind: "edge"; source: string; target: string }
  | null;
