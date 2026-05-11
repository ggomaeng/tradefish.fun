/**
 * POST /api/queries — asker submits a question.
 * Body: { token_mint, question_type, asker_id? }
 *
 * Auth: a Solana wallet pubkey in `X-Wallet-Pubkey` header is REQUIRED.
 * The wallet must hold ≥ 10 credits (top up via /api/credits/topup).
 * Anonymous asks are intentionally not supported — every question is paid.
 *
 * Side effects:
 *   1. Validate wallet pubkey shape
 *   2. Validate token is in supported_tokens
 *   3. Atomic 10-credit debit on wallet_credits (race-safe via `gte`)
 *   4. Snapshot Pyth price as the round's reference (refunds on failure)
 *   5. Insert into queries (refunds on failure)
 *   6. Fan out to webhook agents (best-effort, async)
 */
import { type NextRequest } from "next/server";
import { z } from "zod";
import bs58 from "bs58";
import { dbAdmin } from "@/lib/db";
import { getPythPrice } from "@/lib/clients/pyth";
import { shortId } from "@/lib/utils";
import { enforce, rateLimitedResponse, subjectFromRequest } from "@/lib/rate-limit";
import { apiError, logError, requestId } from "@/lib/api-error";

const ROUTE = "/api/queries";

const QUERY_DEADLINE_MS = 60 * 1000;     // agents have 60s to respond
const CREDITS_PER_QUERY = 10;

const Schema = z.object({
  token_mint: z.string().min(32),
  question_type: z.enum(["buy_sell_now"]),
  asker_id: z.string().optional(),
});

function isValidSolanaPubkey(s: string): boolean {
  try {
    return bs58.decode(s).length === 32;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const rid = requestId(request);

  // 1. Wallet auth required — humans pay for every question.
  const walletPubkey = request.headers.get("x-wallet-pubkey")?.trim() || null;
  if (!walletPubkey) {
    return apiError({
      error: "wallet_required",
      code: "wallet_required",
      status: 401,
      request_id: rid,
      extra: { message: "Connect a Solana wallet to ask a question." },
    });
  }
  if (!isValidSolanaPubkey(walletPubkey)) {
    return apiError({
      error: "invalid_wallet_pubkey",
      code: "invalid_wallet_pubkey",
      status: 400,
      request_id: rid,
    });
  }

  // Rate limit: 10 RPM per wallet on /api/queries (RUNBOOK §3).
  const rl = await enforce({
    subject: subjectFromRequest(request, walletPubkey),
    route: "/api/queries",
    window_seconds: 60,
    max_count: 10,
  });
  if (!rl.ok) return rateLimitedResponse(rl);

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
  const { token_mint, question_type, asker_id } = parsed.data;

  const db = dbAdmin();

  // 1. Token must be supported (and active)
  const { data: token } = await db
    .from("supported_tokens")
    .select("mint, symbol, name, pyth_feed_id, active")
    .eq("mint", token_mint)
    .maybeSingle();

  if (!token || !token.active) {
    return apiError({
      error: "unsupported_token",
      code: "unsupported_token",
      status: 400,
      request_id: rid,
    });
  }

  // 3. Wallet credit gating + atomic debit. We do this BEFORE the Pyth call
  //    so a failed oracle doesn't burn credits. The atomicity guard is the
  //    `where credits >= N` clause on the update — concurrent queries on
  //    the same wallet can't both succeed.
  const { data: walletRow } = await db
    .from("wallet_credits")
    .select("credits")
    .eq("wallet_pubkey", walletPubkey)
    .maybeSingle();
  const balance = walletRow?.credits ?? 0;
  if (balance < CREDITS_PER_QUERY) {
    return apiError({
      error: "insufficient_credits",
      code: "insufficient_credits",
      status: 402,
      request_id: rid,
      extra: { needed: CREDITS_PER_QUERY, balance },
    });
  }
  const newBalance = balance - CREDITS_PER_QUERY;
  const { data: updated, error: debitErr } = await db
    .from("wallet_credits")
    .update({
      credits: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("wallet_pubkey", walletPubkey)
    .gte("credits", CREDITS_PER_QUERY) // race-safety: still has enough
    .select("credits")
    .maybeSingle();
  if (debitErr || !updated) {
    // Another query beat us to the credits.
    if (debitErr) {
      logError({ route: ROUTE, code: "insufficient_credits_race", request_id: rid, err: debitErr });
    }
    return apiError({
      error: "insufficient_credits_race",
      code: "insufficient_credits_race",
      status: 402,
      request_id: rid,
      extra: { needed: CREDITS_PER_QUERY },
    });
  }

  // 3. Snapshot Pyth price as round reference
  const pythPrice = await getPythPrice(token.pyth_feed_id);
  if (pythPrice === null) {
    await refundWalletCredits(walletPubkey);
    logError({ route: ROUTE, code: "oracle_unavailable", request_id: rid });
    return apiError({
      error: "oracle_unavailable",
      code: "oracle_unavailable",
      status: 503,
      request_id: rid,
    });
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
    logError({ route: ROUTE, code: "create_failed", request_id: rid, err: error });
    await refundWalletCredits(walletPubkey);
    return apiError({
      error: "create_failed",
      code: "create_failed",
      status: 500,
      request_id: rid,
    });
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

/**
 * Refund credits previously debited from a wallet when a downstream step
 * (oracle, insert) fails after the debit has happened. Best-effort — logs
 * on failure but never throws to the caller. No-op when wallet is null.
 */
async function refundWalletCredits(walletPubkey: string | null) {
  if (!walletPubkey) return;
  const db = dbAdmin();
  const { data: row } = await db
    .from("wallet_credits")
    .select("credits")
    .eq("wallet_pubkey", walletPubkey)
    .maybeSingle();
  if (!row) return;
  const { error } = await db
    .from("wallet_credits")
    .update({
      credits: row.credits + CREDITS_PER_QUERY,
      updated_at: new Date().toISOString(),
    })
    .eq("wallet_pubkey", walletPubkey);
  if (error) {
    console.error("[queries] refund failed:", error);
  }
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
