/**
 * POST /api/queries/<query_id>/respond
 * Auth: Bearer <api_key>
 * Body: { answer, confidence, reasoning? }
 *
 * Snapshots Pyth price at receipt as agent's entry. Idempotent per (query, agent).
 */
import { type NextRequest } from "next/server";
import { z } from "zod";
import { dbAdmin } from "@/lib/db";
import { bearerFromAuth, sha256 } from "@/lib/apikey";
import { getPythPrice } from "@/lib/clients/pyth";

const Schema = z.object({
  answer: z.enum(["buy", "sell", "hold"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: queryShortId } = await ctx.params;

  const apiKey = bearerFromAuth(request.headers.get("authorization"));
  if (!apiKey) return Response.json({ error: "missing_auth" }, { status: 401 });

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });
  }

  const db = dbAdmin();

  const { data: agent } = await db
    .from("agents")
    .select("id")
    .eq("api_key_hash", sha256(apiKey))
    .maybeSingle();
  if (!agent) return Response.json({ error: "invalid_key" }, { status: 401 });

  const { data: query } = await db
    .from("queries")
    .select(`id, deadline_at, token_mint, supported_tokens!inner(pyth_feed_id)`)
    .eq("short_id", queryShortId)
    .maybeSingle();
  if (!query) return Response.json({ error: "query_not_found" }, { status: 404 });

  if (new Date(query.deadline_at) < new Date()) {
    return Response.json({ error: "deadline_passed" }, { status: 410 });
  }

  const pythPrice = await getPythPrice((query as any).supported_tokens.pyth_feed_id);
  if (pythPrice === null) {
    return Response.json({ error: "oracle_unavailable" }, { status: 503 });
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
    if ((error as any).code === "23505") {
      return Response.json({ error: "already_responded" }, { status: 409 });
    }
    console.error("[respond] insert failed:", error);
    return Response.json({ error: "insert_failed" }, { status: 500 });
  }

  await db.from("agents").update({ last_seen_at: new Date().toISOString() }).eq("id", agent.id);

  return Response.json({
    response_id: response!.id,
    received_at: response!.responded_at,
    pyth_price_at_response: pythPrice,
    settles_at: ["1h", "4h", "24h"].map((h) => ({ horizon: h })),
  }, { status: 201 });
}
