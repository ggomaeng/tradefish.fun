/**
 * POST /api/queries — asker submits a question.
 * Body: { token_mint, question_type, asker_id? }
 * Side effects:
 *   1. Validate token is in supported_tokens
 *   2. Snapshot Pyth price as the round's reference
 *   3. Debit credits (if asker_id provided)
 *   4. Insert into queries
 *   5. Fan out to webhook agents (best-effort, async)
 */
import { type NextRequest } from "next/server";
import { z } from "zod";
import { dbAdmin } from "@/lib/db";
import { getPythPrice } from "@/lib/clients/pyth";
import { shortId } from "@/lib/utils";

const QUERY_DEADLINE_MS = 60 * 1000;     // agents have 60s to respond
const CREDITS_PER_QUERY = 10;

const Schema = z.object({
  token_mint: z.string().min(32),
  question_type: z.enum(["buy_sell_now"]),
  asker_id: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });
  }
  const { token_mint, question_type, asker_id } = parsed.data;

  const db = dbAdmin();

  // 1. Token must be supported (and active)
  const { data: token } = await db
    .from("supported_tokens")
    .select("mint, symbol, name, pyth_feed_id, active")
    .eq("mint", token_mint)
    .maybeSingle();

  if (!token || !token.active) {
    return Response.json({ error: "unsupported_token" }, { status: 400 });
  }

  // 2. Check credits if asker is identified
  if (asker_id) {
    const { data: bal } = await db
      .from("credits_balance")
      .select("balance")
      .eq("user_id", asker_id)
      .maybeSingle();
    if (!bal || bal.balance < CREDITS_PER_QUERY) {
      return Response.json({ error: "insufficient_credits", required: CREDITS_PER_QUERY }, { status: 402 });
    }
  }

  // 3. Snapshot Pyth price as round reference
  const pythPrice = await getPythPrice(token.pyth_feed_id);
  if (pythPrice === null) {
    return Response.json({ error: "oracle_unavailable" }, { status: 503 });
  }

  // 4. Insert query
  const now = new Date();
  const deadline = new Date(now.getTime() + QUERY_DEADLINE_MS);
  const { data: query, error } = await db
    .from("queries")
    .insert({
      short_id: shortId("qry", 10),
      asker_id: asker_id ?? null,
      token_mint,
      question_type,
      asked_at: now.toISOString(),
      deadline_at: deadline.toISOString(),
      pyth_price_at_ask: pythPrice,
      credits_spent: CREDITS_PER_QUERY,
    })
    .select("id, short_id, asked_at, deadline_at")
    .single();

  if (error || !query) {
    console.error("[queries] insert failed:", error);
    return Response.json({ error: "create_failed" }, { status: 500 });
  }

  // 5. Debit credits
  if (asker_id) {
    await db.from("credits_ledger").insert({
      user_id: asker_id,
      delta: -CREDITS_PER_QUERY,
      reason: "query_spend",
      ref_query_id: query.id,
    });
  }

  // 6. Fan out to webhook agents (fire-and-forget). Polling agents will pick up via /pending.
  void dispatchToWebhookAgents(query.short_id, token.mint, token.symbol, deadline.toISOString());

  return Response.json({
    query_id: query.short_id,
    token: { mint: token.mint, symbol: token.symbol },
    asked_at: query.asked_at,
    deadline_at: query.deadline_at,
    pyth_price_at_ask: pythPrice,
  }, { status: 201 });
}

async function dispatchToWebhookAgents(
  queryShortId: string,
  mint: string,
  symbol: string,
  deadlineIso: string,
) {
  // Forward to internal dispatcher; never block the asker's request on this.
  try {
    const url = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/internal/dispatch`;
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.INTERNAL_WEBHOOK_HMAC_SECRET ?? ""}`,
      },
      body: JSON.stringify({ query_id: queryShortId, mint, symbol, deadline_at: deadlineIso }),
    });
  } catch (err) {
    console.error("[queries] dispatch trigger failed:", err);
  }
}
