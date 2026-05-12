/**
 * POST /api/internal/demo-ask
 *
 * Fired by Vercel cron every 5 minutes. Auto-opens a buy_sell_now round on
 * the next rotating supported token, bypassing the wallet-credit gate.
 *
 * Auth:    Authorization: Bearer ${DEMO_CRON_SECRET}
 * Effect:  inserts queries.is_demo=true row, dispatches to webhook agents
 *          (best-effort), returns 201 with the round info.
 *
 * Idempotency: if a demo round on the rotated token is already open, returns
 * 200 {skipped:true} without creating a duplicate.
 *
 * GET is aliased to POST so the route can be smoke-tested with a plain
 * curl GET and so Vercel cron (which sends GET) works without config.
 */
import { type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { dbAdmin } from "@/lib/db";
import { getPythPrice } from "@/lib/clients/pyth";
import { pickNextDemoToken } from "@/lib/demo-cron/rotate-token";
import {
  insertDemoQuery,
  hasOpenDemoRound,
  dispatchToWebhookAgents,
} from "@/lib/demo-cron/insert-demo-query";
import { apiError, logError, requestId } from "@/lib/api-error";

const ROUTE = "/api/internal/demo-ask";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function handle(request: NextRequest) {
  const rid = requestId(request);

  const expected = process.env.DEMO_CRON_SECRET;
  if (!expected) {
    logError({ route: ROUTE, code: "cron_secret_unset", request_id: rid });
    return apiError({
      error: "cron_secret_unset",
      code: "cron_secret_unset",
      status: 500,
      request_id: rid,
    });
  }
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const a = Buffer.from(bearer);
  const b = Buffer.from(expected);
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (!ok) {
    return apiError({
      error: "unauthorized",
      code: "unauthorized",
      status: 401,
      request_id: rid,
    });
  }

  const db = dbAdmin();

  // 1) Pick the next token in rotation.
  const token = await pickNextDemoToken(db);
  if (!token) {
    logError({ route: ROUTE, code: "no_active_tokens", request_id: rid });
    return apiError({
      error: "no_active_tokens",
      code: "no_active_tokens",
      status: 503,
      request_id: rid,
    });
  }

  // 2) Idempotency: a demo round on this token is already open → skip.
  if (await hasOpenDemoRound(db, token.mint)) {
    return Response.json({
      ok: true,
      skipped: true,
      reason: "already_open",
      token: { mint: token.mint, symbol: token.symbol },
    });
  }

  // 3) Snapshot Pyth price. Null → 503, cron retries next tick.
  const price = await getPythPrice(token.pyth_feed_id);
  if (price === null) {
    logError({
      route: ROUTE,
      code: "oracle_unavailable",
      request_id: rid,
      err: { symbol: token.symbol, feed_id: token.pyth_feed_id },
    });
    return apiError({
      error: "oracle_unavailable",
      code: "oracle_unavailable",
      status: 503,
      request_id: rid,
    });
  }

  // 4) Insert the round.
  const inserted = await insertDemoQuery(db, {
    token_mint: token.mint,
    pyth_price: price,
  });
  if (!inserted.ok) {
    logError({
      route: ROUTE,
      code: "insert_failed",
      request_id: rid,
      err: inserted.error,
    });
    return apiError({
      error: "insert_failed",
      code: "insert_failed",
      status: 500,
      request_id: rid,
    });
  }

  // 5) Fan out to webhook agents — fire-and-forget. Polling agents pick up
  //    via /api/queries/pending on their next 10s tick.
  void dispatchToWebhookAgents({
    query_id: inserted.query.query_id,
    mint: token.mint,
    symbol: token.symbol,
    deadline_at: inserted.query.deadline_at,
  });

  return Response.json(
    {
      ok: true,
      query_id: inserted.query.query_id,
      token: { mint: token.mint, symbol: token.symbol },
      asked_at: inserted.query.asked_at,
      deadline_at: inserted.query.deadline_at,
      pyth_price_at_ask: price,
    },
    { status: 201 },
  );
}

export async function POST(request: NextRequest) {
  return handle(request);
}

export async function GET(request: NextRequest) {
  return handle(request);
}
