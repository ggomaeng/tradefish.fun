/**
 * POST /api/brain/ingest
 * Auth: Bearer <api_key>
 *
 * Scholar agents POST distilled lessons here. The server embeds the content,
 * deduplicates via cosine similarity, and either merges into an existing note
 * or inserts a new one with adjacency edges.
 *
 * Auth: agent API key required. Agent ID must appear in SCHOLAR_AGENT_IDS env
 * (comma-separated UUIDs). Returns 403 if not on the allowlist.
 */
import { type NextRequest } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { dbAdmin } from "@/lib/db";
import { bearerFromAuth, sha256 } from "@/lib/apikey";
import { dedupOrPrepare } from "@/lib/brain/dedup";
import { apiError, logError, requestId } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const ROUTE = "/api/brain/ingest";
const EMBED_MODEL = "text-embedding-3-small";

const Schema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10_000),
  tokens: z.array(z.string()).optional(),
  source_round_id: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
});

// ── OpenAI singleton ──────────────────────────────────────────────────────────
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (_openai) return _openai;
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not configured");
  _openai = new OpenAI({ apiKey: key });
  return _openai;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a string to kebab-case slug. */
function toKebab(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .slice(0, 80);
}

/** Return a slug unique in wiki_entries, appending -2, -3, … on collision. */
async function uniqueSlug(base: string): Promise<string> {
  const db = dbAdmin();
  let candidate = base;
  let suffix = 1;
  while (true) {
    const { data } = await db
      .from("wiki_entries")
      .select("slug")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

/** Embed a string with text-embedding-3-small. */
async function embed(text: string): Promise<number[]> {
  const client = getOpenAI();
  const { data } = await client.embeddings.create({
    model: EMBED_MODEL,
    input: text,
  });
  const embedding = data[0]?.embedding;
  if (!embedding) throw new Error("No embedding returned from OpenAI");
  return embedding;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const rid = requestId(request);

  // 1. Auth — agent API key
  const apiKey = bearerFromAuth(request.headers.get("authorization"));
  if (!apiKey) {
    return apiError({ error: "missing_auth", code: "missing_auth", status: 401, request_id: rid });
  }

  const db = dbAdmin();

  const { data: agent } = await db
    .from("agents")
    .select("id")
    .eq("api_key_hash", sha256(apiKey))
    .maybeSingle();

  if (!agent) {
    return apiError({ error: "invalid_key", code: "invalid_key", status: 401, request_id: rid });
  }

  // 2. Scholar allowlist check
  const allowlist = (process.env.SCHOLAR_AGENT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowlist.length > 0 && !allowlist.includes(agent.id)) {
    return apiError({
      error: "forbidden",
      code: "not_scholar",
      status: 403,
      request_id: rid,
      extra: { message: "Agent is not on the scholar allowlist." },
    });
  }

  // 3. Validate body
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError({
      error: "validation_failed",
      code: "validation_failed",
      status: 400,
      request_id: rid,
      extra: { issues: parsed.error.issues },
    });
  }
  const { title, content, tokens, source_round_id, tags } = parsed.data;

  // 4. Embed title + content
  let embedding: number[];
  try {
    embedding = await embed(`${title}\n\n${content}`);
  } catch (err) {
    logError({ route: ROUTE, code: "embed_failed", request_id: rid, err });
    return apiError({ error: "embed_failed", code: "embed_failed", status: 500, request_id: rid });
  }

  // 5. Dedup check
  let dedup: Awaited<ReturnType<typeof dedupOrPrepare>>;
  try {
    dedup = await dedupOrPrepare(embedding);
  } catch (err) {
    logError({ route: ROUTE, code: "dedup_failed", request_id: rid, err });
    return apiError({ error: "dedup_failed", code: "dedup_failed", status: 500, request_id: rid });
  }

  // ── Merge branch ──────────────────────────────────────────────────────────
  if (dedup.action === "merge") {
    const { existing_slug, similarity } = dedup;

    // Fetch current note
    const { data: existing } = await db
      .from("wiki_entries")
      .select("content, tokens, cite_count, source_round_id")
      .eq("slug", existing_slug)
      .maybeSingle();

    if (!existing) {
      // Race condition — fall through to insert
      logError({ route: ROUTE, code: "merge_target_missing", request_id: rid });
    } else {
      const combined = `${existing.content}\n\n${content}`;

      // Re-embed combined text
      let mergedEmbedding: number[];
      try {
        mergedEmbedding = await embed(`${title}\n\n${combined}`);
      } catch (err) {
        logError({ route: ROUTE, code: "merge_embed_failed", request_id: rid, err });
        return apiError({ error: "embed_failed", code: "embed_failed", status: 500, request_id: rid });
      }

      // Array union for tokens
      const existingTokens: string[] = existing.tokens ?? [];
      const mergedTokens = Array.from(new Set([...existingTokens, ...(tokens ?? [])]));

      const { error: updateErr } = await db
        .from("wiki_entries")
        .update({
          content: combined,
          embedding: mergedEmbedding,
          cite_count: (existing.cite_count ?? 0) + 1,
          tokens: mergedTokens,
          ...(source_round_id && !existing.source_round_id
            ? { source_round_id }
            : {}),
        })
        .eq("slug", existing_slug);

      if (updateErr) {
        logError({ route: ROUTE, code: "merge_update_failed", request_id: rid, err: updateErr });
        return apiError({ error: "merge_failed", code: "merge_failed", status: 500, request_id: rid });
      }

      return Response.json({ status: "merged", slug: existing_slug, similarity }, { status: 200 });
    }
  }

  // ── Insert branch ─────────────────────────────────────────────────────────
  const neighbors = dedup.action === "insert" ? dedup.neighbors : [];

  const baseSlug = toKebab(title) || "note";
  let slug: string;
  try {
    slug = await uniqueSlug(baseSlug);
  } catch (err) {
    logError({ route: ROUTE, code: "slug_failed", request_id: rid, err });
    return apiError({ error: "slug_failed", code: "slug_failed", status: 500, request_id: rid });
  }

  const { error: insertErr } = await db.from("wiki_entries").insert({
    slug,
    title,
    content,
    embedding,
    tags: tags ?? [],
    tokens: tokens ?? [],
    author_agent_id: agent.id,
    source_round_id: source_round_id ?? null,
    created_at: new Date().toISOString(),
  });

  if (insertErr) {
    logError({ route: ROUTE, code: "insert_failed", request_id: rid, err: insertErr });
    return apiError({ error: "insert_failed", code: "insert_failed", status: 500, request_id: rid });
  }

  // Upsert note_edges for top-8 neighbors (canonicalize: from_slug < to_slug)
  if (neighbors.length > 0) {
    const edgeRows = neighbors.map((n) => {
      const [from_slug, to_slug] =
        slug < n.slug ? [slug, n.slug] : [n.slug, slug];
      return {
        from_slug,
        to_slug,
        similarity: n.similarity,
        co_cite_count: 0,
        pnl_flow_usd: 0,
        updated_at: new Date().toISOString(),
      };
    });

    const { error: edgeErr } = await db
      .from("note_edges")
      .upsert(edgeRows, { onConflict: "from_slug,to_slug" });

    if (edgeErr) {
      // Non-fatal — log but don't fail the response
      logError({ route: ROUTE, code: "edge_upsert_failed", request_id: rid, err: edgeErr });
    }
  }

  return Response.json({ status: "inserted", slug }, { status: 201 });
}
