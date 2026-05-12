/**
 * POST /api/queries/<query_id>/respond
 * Auth: Bearer <api_key>
 * Body: { answer, confidence, reasoning?, retrieval_id?, cited_slugs? }
 *
 * Snapshots Pyth price at receipt as agent's entry. Idempotent per (query, agent).
 *
 * Brain integration:
 * - If `retrieval_id` is provided: reads agent_retrievals.slugs and upserts
 *   answer_citations rows with source='retrieved', weight=1.0.
 * - If `cited_slugs` is provided: upserts answer_citations rows with
 *   source='explicit', weight=2.0 (explicit always wins on conflict).
 * - Increments wiki_entries.cite_count for every unique slug touched.
 */
import { type NextRequest } from "next/server";
import { z } from "zod";
import { dbAdmin } from "@/lib/db";
import { bearerFromAuth, sha256 } from "@/lib/apikey";
import { getPythPrice } from "@/lib/clients/pyth";
import { apiError, logError, requestId } from "@/lib/api-error";

const ROUTE = "/api/queries/[id]/respond";

const Schema = z.object({
  answer: z.enum(["buy", "sell", "hold"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(500).optional(),
  retrieval_id: z.string().uuid().optional(),
  cited_slugs: z.array(z.string().min(1).max(200)).max(50).optional(),
});

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: queryShortId } = await ctx.params;
  const rid = requestId(request);

  const apiKey = bearerFromAuth(request.headers.get("authorization"));
  if (!apiKey) {
    return apiError({
      error: "missing_auth",
      code: "missing_auth",
      status: 401,
      request_id: rid,
    });
  }

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

  const db = dbAdmin();

  const { data: agent } = await db
    .from("agents")
    .select("id")
    .eq("api_key_hash", sha256(apiKey))
    .maybeSingle();
  if (!agent) {
    return apiError({
      error: "invalid_key",
      code: "invalid_key",
      status: 401,
      request_id: rid,
    });
  }

  const { data: query } = await db
    .from("queries")
    .select(`id, deadline_at, token_mint, supported_tokens!inner(pyth_feed_id)`)
    .eq("short_id", queryShortId)
    .maybeSingle();
  if (!query) {
    return apiError({
      error: "query_not_found",
      code: "query_not_found",
      status: 404,
      request_id: rid,
    });
  }

  if (new Date(query.deadline_at) < new Date()) {
    return apiError({
      error: "deadline_passed",
      code: "deadline_passed",
      status: 410,
      request_id: rid,
    });
  }

  const pythPrice = await getPythPrice(
    (query as unknown as { supported_tokens: { pyth_feed_id: string } }).supported_tokens.pyth_feed_id,
  );
  if (pythPrice === null) {
    logError({ route: ROUTE, code: "oracle_unavailable", request_id: rid });
    return apiError({
      error: "oracle_unavailable",
      code: "oracle_unavailable",
      status: 503,
      request_id: rid,
    });
  }

  const { data: response, error } = await db
    .from("responses")
    .insert({
      query_id: query.id,
      agent_id: agent.id,
      answer: parsed.data.answer,
      confidence: parsed.data.confidence,
      reasoning: parsed.data.reasoning ?? null,
      pyth_price_at_response: pythPrice,
    })
    .select("id, responded_at")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return apiError({
        error: "already_responded",
        code: "already_responded",
        status: 409,
        request_id: rid,
      });
    }
    logError({ route: ROUTE, code: "insert_failed", request_id: rid, err: error });
    return apiError({
      error: "insert_failed",
      code: "insert_failed",
      status: 500,
      request_id: rid,
    });
  }

  await db.from("agents").update({ last_seen_at: new Date().toISOString() }).eq("id", agent.id);

  // ── Brain: citation capture (best-effort, non-fatal) ──────────────────────
  const { retrieval_id, cited_slugs } = parsed.data;
  void captureCitations(response!.id, agent.id, retrieval_id, cited_slugs);

  return Response.json({
    response_id: response!.id,
    received_at: response!.responded_at,
    pyth_price_at_response: pythPrice,
    settles_at: ["1h", "4h", "24h"].map((h) => ({ horizon: h })),
  }, { status: 201 });
}

/**
 * Asynchronously capture answer_citations and bump cite_count.
 * Runs after the 201 response is sent — never blocks the agent.
 */
async function captureCitations(
  answerId: string,
  agentId: string,
  retrievalId?: string,
  citedSlugs?: string[],
) {
  if (!retrievalId && (!citedSlugs || citedSlugs.length === 0)) return;

  const db = dbAdmin();
  const allSlugs = new Set<string>();

  // ── retrieved citations ───────────────────────────────────────────────────
  if (retrievalId) {
    try {
      const { data: retrieval } = await db
        .from("agent_retrievals")
        .select("slugs")
        .eq("id", retrievalId)
        .eq("agent_id", agentId)
        .maybeSingle();

      if (retrieval?.slugs && retrieval.slugs.length > 0) {
        const rows = retrieval.slugs.map((slug: string) => ({
          answer_id: answerId,
          slug,
          source: "retrieved" as const,
          weight: 1.0,
        }));

        await db
          .from("answer_citations")
          .upsert(rows, { onConflict: "answer_id,slug", ignoreDuplicates: true });

        for (const s of retrieval.slugs) allSlugs.add(s);
      }
    } catch (err) {
      console.error("[respond] retrieval citation failed:", err);
    }
  }

  // ── explicit citations (override retrieved) ───────────────────────────────
  if (citedSlugs && citedSlugs.length > 0) {
    try {
      const rows = citedSlugs.map((slug) => ({
        answer_id: answerId,
        slug,
        source: "explicit" as const,
        weight: 2.0,
      }));

      // Explicit always wins — update source+weight on conflict
      await db
        .from("answer_citations")
        .upsert(rows, { onConflict: "answer_id,slug" });

      for (const s of citedSlugs) allSlugs.add(s);
    } catch (err) {
      console.error("[respond] explicit citation failed:", err);
    }
  }

  // ── bump cite_count for every unique slug touched ─────────────────────────
  if (allSlugs.size > 0) {
    try {
      const slugArray = Array.from(allSlugs);
      // Supabase JS doesn't expose direct SQL UPDATE with WHERE IN + increment,
      // so we use rpc or a manual fetch+update. We use rpc "increment" pattern:
      // since there's no custom RPC yet, do a read+write per slug batch.
      // For v1 this is acceptable (max 50 slugs per answer).
      for (const slug of slugArray) {
        const { data: entry } = await db
          .from("wiki_entries")
          .select("cite_count")
          .eq("slug", slug)
          .maybeSingle();
        if (entry) {
          await db
            .from("wiki_entries")
            .update({ cite_count: (entry.cite_count ?? 0) + 1 })
            .eq("slug", slug);
        }
      }
    } catch (err) {
      console.error("[respond] cite_count bump failed:", err);
    }
  }
}
