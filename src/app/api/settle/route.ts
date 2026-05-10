/**
 * Vercel Cron: settle responses whose 1h / 4h / 24h windows have elapsed.
 *
 * Cron config (vercel.json):
 *   { "path": "/api/settle", "schedule": "*\/5 * * * *" }   // every 5 min
 *
 * Auth: caller must send `Authorization: Bearer <SETTLEMENT_CRON_SECRET>`.
 * Vercel Cron sends this header automatically once the env var is configured
 * on the project (Preview + Production scopes).
 *
 * Failure modes:
 *  - SETTLEMENT_CRON_SECRET unset on the server  → 500 misconfigured.
 *  - Authorization header missing / not Bearer   → 401 unauthorized.
 *  - Bearer value mismatches secret              → 401 unauthorized.
 *
 * Comparison is constant-time via `crypto.timingSafeEqual`. Length mismatch
 * is short-circuited to a fixed-length compare so we don't leak the secret
 * length via timing.
 */
import { type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { dbAdmin } from "@/lib/db";
import { getPythPrices } from "@/lib/clients/pyth";
import { computeSettlement, WINDOWS, WINDOW_MS, type Window, type Answer } from "@/lib/settlement";
import { requestId } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type AuthOk = { ok: true };
type AuthErr = { ok: false; response: Response };

/**
 * Gate Vercel Cron callers. Constant-time secret compare. Returns either
 * `{ ok: true }` (let the handler run) or `{ ok: false, response }` (return
 * the response immediately).
 */
function authorize(request: NextRequest): AuthOk | AuthErr {
  const rid = requestId();
  const secret = process.env.SETTLEMENT_CRON_SECRET;
  if (!secret) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "misconfigured",
          code: "missing_secret",
          message: "SETTLEMENT_CRON_SECRET is not set on the server.",
          request_id: rid,
        },
        { status: 500, headers: { "X-Request-Id": rid } },
      ),
    };
  }

  const header = request.headers.get("authorization") ?? "";
  // Both header and `Bearer <secret>` must match exactly. We use timingSafeEqual
  // over equal-length buffers; on length mismatch we still run a fixed-length
  // compare (against the expected value) so timing doesn't disclose length.
  const expected = `Bearer ${secret}`;
  const expectedBuf = Buffer.from(expected, "utf8");
  const headerBuf = Buffer.from(header, "utf8");

  let matches = false;
  if (headerBuf.length === expectedBuf.length) {
    matches = timingSafeEqual(headerBuf, expectedBuf);
  } else {
    // Length mismatch — run a dummy compare against expected with itself to
    // keep the timing path roughly constant, then force false.
    timingSafeEqual(expectedBuf, expectedBuf);
    matches = false;
  }

  if (!matches) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "unauthorized",
          code: "invalid_settlement_secret",
          request_id: rid,
        },
        { status: 401, headers: { "X-Request-Id": rid } },
      ),
    };
  }
  return { ok: true };
}

export async function GET(request: NextRequest) {
  const auth = authorize(request);
  if (!auth.ok) return auth.response;

  const db = dbAdmin();
  const now = Date.now();
  const summary: Record<Window, number> = { "1h": 0, "4h": 0, "24h": 0 };

  for (const window of WINDOWS) {
    const cutoffIso = new Date(now - WINDOW_MS[window]).toISOString();

    // Find responses that crossed this window's elapsed threshold and aren't yet settled.
    const { data: due, error } = await db
      .from("responses")
      .select(`
        id,
        answer,
        confidence,
        pyth_price_at_response,
        responded_at,
        query_id,
        queries!inner(token_mint, supported_tokens!inner(pyth_feed_id))
      `)
      .lte("responded_at", cutoffIso)
      .limit(200);

    if (error) {
      console.error(`[settle:${window}] fetch failed:`, error);
      continue;
    }
    if (!due || due.length === 0) continue;

    // Filter out already-settled (response_id, horizon) pairs
    const ids = due.map((d: any) => d.id);
    const { data: existing } = await db
      .from("settlements")
      .select("response_id")
      .in("response_id", ids)
      .eq("horizon", window);
    const settledSet = new Set((existing ?? []).map((s) => s.response_id));
    const toSettle = due.filter((d: any) => !settledSet.has(d.id));
    if (toSettle.length === 0) continue;

    // Batch-fetch current Pyth prices for all unique feeds
    const feedIds = Array.from(new Set(toSettle.map((d: any) => d.queries.supported_tokens.pyth_feed_id)));
    const prices = await getPythPrices(feedIds);

    const rows = [];
    for (const d of toSettle as any[]) {
      const feedId = d.queries.supported_tokens.pyth_feed_id;
      const exitPrice = prices[feedId.startsWith("0x") ? feedId : `0x${feedId}`];
      if (exitPrice === undefined) continue;

      const result = computeSettlement({
        answer: d.answer as Answer,
        confidence: Number(d.confidence),
        priceAtResponse: Number(d.pyth_price_at_response),
        priceAtSettle: exitPrice,
        window,
      });

      rows.push({
        response_id: d.id,
        horizon: window,
        pnl_pct: result.pnlPct,
        pyth_price_at_settle: exitPrice,
        direction_correct: result.directionCorrect,
      });
    }

    if (rows.length > 0) {
      const { error: insErr } = await db.from("settlements").insert(rows);
      if (insErr) {
        console.error(`[settle:${window}] insert failed:`, insErr);
      } else {
        summary[window] = rows.length;
      }
    }
  }

  return Response.json({ ok: true, settled: summary, ran_at: new Date().toISOString() });
}
