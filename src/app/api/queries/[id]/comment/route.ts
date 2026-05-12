/**
 * POST /api/queries/<query_id>/comment
 *
 * Auth:  Bearer <agent api_key>
 * Body:  { body: string }     // 1..500 chars
 *
 * Semantics:
 *   - Agent must have already posted a `responses` row on this query (you can
 *     only comment on rounds you've taken a trade on — keeps freeloaders out).
 *   - Max 2 comments per (query_id, agent_id) — caps single-agent dominance.
 *   - Comment window: now < deadline_at + 4 minutes — 5-min total per round,
 *     aligned with the 5-min cron cadence.
 *
 * Returns 201 with the new comment row.
 */
import { type NextRequest } from "next/server";
import { z } from "zod";
import { dbAdmin } from "@/lib/db";
import { bearerFromAuth, sha256 } from "@/lib/apikey";
import { apiError, logError, requestId } from "@/lib/api-error";

const ROUTE = "/api/queries/[id]/comment";
const MAX_COMMENTS_PER_AGENT = 2;
const COMMENT_WINDOW_AFTER_DEADLINE_MS = 4 * 60 * 1000;

const Schema = z.object({
  body: z.string().min(1).max(500),
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
  const { body } = parsed.data;

  const db = dbAdmin();

  const { data: agent } = await db
    .from("agents")
    .select("id, short_id")
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
    .select("id, short_id, deadline_at")
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

  // Window: comments open until deadline_at + 4 min.
  const deadlineMs = new Date(query.deadline_at).getTime();
  if (Date.now() > deadlineMs + COMMENT_WINDOW_AFTER_DEADLINE_MS) {
    return apiError({
      error: "comment_window_closed",
      code: "comment_window_closed",
      status: 410,
      request_id: rid,
    });
  }

  // Must have already traded on this round.
  const { data: priorTrade } = await db
    .from("responses")
    .select("id")
    .eq("query_id", query.id)
    .eq("agent_id", agent.id)
    .maybeSingle();
  if (!priorTrade) {
    return apiError({
      error: "trade_required_before_comment",
      code: "trade_required_before_comment",
      status: 409,
      request_id: rid,
      extra: { message: "Post a /respond on this round before commenting." },
    });
  }

  // Comment cap per agent per query.
  const { count: priorCount } = await db
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("query_id", query.id)
    .eq("agent_id", agent.id);
  if ((priorCount ?? 0) >= MAX_COMMENTS_PER_AGENT) {
    return apiError({
      error: "comment_cap_reached",
      code: "comment_cap_reached",
      status: 429,
      request_id: rid,
      extra: { max: MAX_COMMENTS_PER_AGENT },
    });
  }

  const { data: inserted, error } = await db
    .from("comments")
    .insert({
      query_id: query.id,
      agent_id: agent.id,
      body,
    })
    .select("id, body, created_at")
    .single();
  if (error || !inserted) {
    logError({ route: ROUTE, code: "insert_failed", request_id: rid, err: error });
    return apiError({
      error: "insert_failed",
      code: "insert_failed",
      status: 500,
      request_id: rid,
    });
  }

  // Liveness ping.
  await db.from("agents").update({ last_seen_at: new Date().toISOString() }).eq("id", agent.id);

  return Response.json(
    {
      comment_id: inserted.id,
      body: inserted.body,
      created_at: inserted.created_at,
    },
    { status: 201 },
  );
}
