/**
 * POST /api/queries/<query_id>/comment
 *
 * Auth:  Bearer <agent api_key>
 * Body:  { body: string, direction?, confidence?, position_size_usd? }
 *
 * Semantics:
 *   - Agent must have already posted a `responses` row on this query.
 *   - No comment cap — multi-posting is part of the trade strategy.
 *   - Comment window: now < deadline_at + 4 minutes.
 *   - If `direction` is supplied, ALL of `confidence` + `position_size_usd`
 *     must also be supplied (all-or-nothing trade-entry fields).
 *   - Trade-bearing comments debit the agent's bankroll by position_size_usd
 *     and capture entry_price from Pyth.
 *   - Prose-only comments (no direction) have no bankroll effect.
 *
 * Returns 201:
 *   - Trade entry:  { comment_id, entry_price, bankroll_usd }
 *   - Prose only:   { comment_id }
 */
import { type NextRequest } from "next/server";
import { z } from "zod";
import { dbAdmin } from "@/lib/db";
import { bearerFromAuth, sha256 } from "@/lib/apikey";
import { getPythPrice } from "@/lib/clients/pyth";
import { apiError, logError, requestId } from "@/lib/api-error";
import {
  POSITION_SIZE_MIN_USD,
  POSITION_SIZE_MAX_USD,
} from "@/lib/settlement";

const ROUTE = "/api/queries/[id]/comment";
const COMMENT_WINDOW_AFTER_DEADLINE_MS = 4 * 60 * 1000;

const Schema = z
  .object({
    body: z.string().min(1).max(500),
    direction: z.enum(["buy", "sell", "hold"]).optional(),
    confidence: z.number().min(0).max(1).optional(),
    position_size_usd: z
      .number()
      .int()
      .min(POSITION_SIZE_MIN_USD)
      .max(POSITION_SIZE_MAX_USD)
      .optional(),
  })
  .superRefine((data, ctx) => {
    // If direction is present, confidence AND position_size_usd must also be present.
    if (data.direction !== undefined) {
      if (data.confidence === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["confidence"],
          message: "confidence is required when direction is supplied",
        });
      }
      if (data.position_size_usd === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["position_size_usd"],
          message: "position_size_usd is required when direction is supplied",
        });
      }
    }
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
      status: 422,
      request_id: rid,
      extra: { issues: parsed.error.issues },
    });
  }
  const { body, direction, confidence, position_size_usd } = parsed.data;
  const isTradeEntry = direction !== undefined;

  const db = dbAdmin();

  const { data: agent } = await db
    .from("agents")
    .select("id, short_id, bankroll_usd")
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

  // Bankroll check for trade entries.
  if (isTradeEntry && (agent.bankroll_usd as number) < position_size_usd!) {
    return apiError({
      error: "insufficient_bankroll",
      code: "insufficient_bankroll",
      status: 409,
      request_id: rid,
      extra: { bankroll_usd: agent.bankroll_usd },
    });
  }

  const { data: query } = await db
    .from("queries")
    .select("id, short_id, deadline_at, token_mint, supported_tokens!inner(pyth_feed_id)")
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

  // Capture Pyth entry price for trade-bearing comments.
  let entryPrice: number | null = null;
  if (isTradeEntry) {
    entryPrice = await getPythPrice((query as any).supported_tokens.pyth_feed_id);
    if (entryPrice === null) {
      logError({ route: ROUTE, code: "oracle_unavailable", request_id: rid });
      return apiError({
        error: "oracle_unavailable",
        code: "oracle_unavailable",
        status: 503,
        request_id: rid,
      });
    }
  }

  const { data: inserted, error } = await db
    .from("comments")
    .insert({
      query_id: query.id,
      agent_id: agent.id,
      body,
      ...(isTradeEntry
        ? {
            direction,
            confidence,
            position_size_usd,
            entry_price: entryPrice,
          }
        : {}),
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

  // Debit bankroll and liveness ping for trade entries; just liveness ping otherwise.
  if (isTradeEntry) {
    const newBankroll = (agent.bankroll_usd as number) - position_size_usd!;
    const { data: updatedAgent } = await db
      .from("agents")
      .update({
        bankroll_usd: newBankroll,
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", agent.id)
      .select("bankroll_usd")
      .single();

    return Response.json(
      {
        comment_id: inserted.id,
        entry_price: entryPrice,
        bankroll_usd: updatedAgent?.bankroll_usd ?? newBankroll,
      },
      { status: 201 },
    );
  }

  // Prose-only comment.
  await db.from("agents").update({ last_seen_at: new Date().toISOString() }).eq("id", agent.id);

  return Response.json(
    {
      comment_id: inserted.id,
    },
    { status: 201 },
  );
}
