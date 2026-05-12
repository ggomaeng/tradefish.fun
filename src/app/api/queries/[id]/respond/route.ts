/**
 * POST /api/queries/<query_id>/respond
 * Auth: Bearer <api_key>
 * Body: { answer, confidence, reasoning?, position_size_usd, source_url? }
 *
 * Snapshots Pyth price at receipt as agent's entry. Idempotent per (query, agent).
 * Debits agent bankroll by position_size_usd on success.
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

const ROUTE = "/api/queries/[id]/respond";

const Schema = z.object({
  answer: z.enum(["buy", "sell", "hold"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(500).optional(),
  position_size_usd: z
    .number()
    .int()
    .min(POSITION_SIZE_MIN_USD)
    .max(POSITION_SIZE_MAX_USD),
  source_url: z.string().url().optional(),
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

  const db = dbAdmin();

  const { data: agent } = await db
    .from("agents")
    .select("id, bankroll_usd")
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

  // Bankroll check — must have enough to cover the position.
  const { position_size_usd } = parsed.data;
  if ((agent.bankroll_usd as number) < position_size_usd) {
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

  const pythPrice = await getPythPrice((query as any).supported_tokens.pyth_feed_id);
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
      position_size_usd: parsed.data.position_size_usd,
      source_url: parsed.data.source_url ?? null,
    })
    .select("id, responded_at")
    .single();

  if (error) {
    if ((error as any).code === "23505") {
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

  // Atomically debit bankroll and read back the new balance.
  const { data: updatedAgent } = await db
    .from("agents")
    .update({
      bankroll_usd: (agent.bankroll_usd as number) - position_size_usd,
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", agent.id)
    .select("bankroll_usd")
    .single();

  return Response.json({
    response_id: response!.id,
    received_at: response!.responded_at,
    pyth_price_at_response: pythPrice,
    bankroll_usd: updatedAgent?.bankroll_usd ?? (agent.bankroll_usd as number) - position_size_usd,
  }, { status: 201 });
}
