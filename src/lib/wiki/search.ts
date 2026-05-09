/**
 * Trade-wiki search.
 *
 * v2: pgvector cosine similarity via the `match_wiki` RPC (see
 * supabase/migrations/0003_wiki_match.sql). Embeds the query string with
 * OpenAI's text-embedding-3-small (1536 dims) and ranks `wiki_entries` by
 * cosine similarity.
 *
 * Falls back to v1 keyword search (postgres ilike) when:
 *   - OPENAI_API_KEY is not set (offline dev)
 *   - the embedding call fails
 *   - the RPC errors (e.g. migration not yet applied)
 *
 * Public API (function name, args, return shape) is stable so the route
 * handler at /api/wiki/search does not need changes.
 */
import OpenAI from "openai";
import { dbAdmin } from "../db";

export type WikiHit = {
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  similarity?: number;
};

const EMBED_MODEL = "text-embedding-3-small";

let _openai: OpenAI | null = null;
function openai(): OpenAI | null {
  if (_openai) return _openai;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  _openai = new OpenAI({ apiKey: key });
  return _openai;
}

export async function searchWiki(query: string, limit = 5): Promise<WikiHit[]> {
  const q = query.trim();
  if (!q) return [];

  const client = openai();
  if (!client) {
    console.warn("[wiki] OPENAI_API_KEY not set — falling back to keyword search");
    return keywordSearch(q, limit);
  }

  // Embed → RPC. Any failure degrades to keyword search.
  try {
    const { data: embeds } = await client.embeddings.create({
      model: EMBED_MODEL,
      input: q,
    });
    const embedding = embeds[0]?.embedding;
    if (!embedding) throw new Error("no embedding returned");

    const db = dbAdmin();
    const { data, error } = await db.rpc("match_wiki", {
      query_embedding: embedding,
      match_count: limit,
      match_threshold: 0.0,
    });

    if (error) throw error;

    // RPC returns rows without `tags`; backfill via a follow-up select keyed by slug.
    const rows = (data ?? []) as Array<{
      slug: string;
      title: string;
      content: string;
      similarity: number;
    }>;
    if (rows.length === 0) return [];

    const slugs = rows.map((r) => r.slug);
    const { data: tagRows } = await db
      .from("wiki_entries")
      .select("slug, tags")
      .in("slug", slugs);
    const tagsBySlug = new Map<string, string[]>(
      (tagRows ?? []).map((r: { slug: string; tags: string[] | null }) => [r.slug, r.tags ?? []])
    );

    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      excerpt: excerpt(row.content, q),
      tags: tagsBySlug.get(row.slug) ?? [],
      similarity: row.similarity,
    }));
  } catch (err) {
    console.warn("[wiki] vector search failed, falling back to keyword:", err);
    return keywordSearch(q, limit);
  }
}

/** v1 keyword path. Kept as graceful degrade. */
async function keywordSearch(q: string, limit: number): Promise<WikiHit[]> {
  const db = dbAdmin();
  const pattern = `%${q.replace(/[%_]/g, "\\$&")}%`;

  const { data, error } = await db
    .from("wiki_entries")
    .select("slug, title, content, tags")
    .or(`title.ilike.${pattern},content.ilike.${pattern}`)
    .limit(limit);

  if (error) {
    console.error("[wiki] keyword search error:", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    slug: row.slug,
    title: row.title,
    excerpt: excerpt(row.content, q),
    tags: row.tags ?? [],
  }));
}

function excerpt(content: string, q: string, padding = 120): string {
  const idx = content.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return content.slice(0, padding * 2) + (content.length > padding * 2 ? "…" : "");
  const start = Math.max(0, idx - padding);
  const end = Math.min(content.length, idx + q.length + padding);
  return (start > 0 ? "…" : "") + content.slice(start, end) + (end < content.length ? "…" : "");
}
