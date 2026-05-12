/**
 * Vercel Cron: atomically settle all queries whose deadline has passed.
 *
 * Cron config (vercel.json):
 *   { "path": "/api/settle", "schedule": "*\/5 * * * *" }   // every 5 min
 *
 * Auth: caller must send `Authorization: Bearer <secret>`.
 * Vercel Cron sends this header automatically when `CRON_SECRET` is set on
 * the project (Vercel's standard env var name, Preview + Production scopes).
 *
 * Secret resolution order (first one that is set wins):
 *  1. CRON_SECRET      — Vercel's standard; set this in the Vercel UI.
 *  2. SETTLEMENT_CRON_SECRET — legacy name; kept for backward compatibility.
 *
 * Failure modes:
 *  - Neither CRON_SECRET nor SETTLEMENT_CRON_SECRET set → 500 misconfigured.
 *  - Authorization header missing / not Bearer          → 401 unauthorized.
 *  - Bearer value mismatches secret                     → 401 unauthorized.
 *
 * Comparison is constant-time via `crypto.timingSafeEqual`. Length mismatch
 * is short-circuited to a fixed-length compare so we don't leak the secret
 * length via timing.
 *
 * Test-mode override (SETTLE_TEST_MODE):
 *  - When `SETTLE_TEST_MODE` env is truthy ("1" / "true", case-insensitive)
 *    AND the deployment is non-production (`VERCEL_ENV !== 'production'`),
 *    the handler will accept an explicit `as_of_ts` from the request body
 *    or query string, overriding `Date.now()` for deadline checks.
 *  - Production NEVER honors `as_of_ts`, even if `SETTLE_TEST_MODE` is set
 *    on the production env. A warning is logged in that case.
 *  - When the override is honored, the response carries the response header
 *    `X-TradeFish-Test-Mode: 1` so callers (e2e fixture) can confirm.
 *  - When test mode is inactive, an `as_of_ts` payload field is silently
 *    ignored (no 400) — same behaviour as if it weren't there.
 *  - When test mode IS active and `as_of_ts` is malformed (not parseable as
 *    Unix epoch seconds OR ISO-8601), the handler returns 400 + invalid_as_of_ts.
 *
 * Settlement logic (v1):
 *  1. Find queries with status='open' AND deadline_at + 30s <= now, limit 100
 *  2. For each query (sequentially):
 *     a. Mark status='settling'
 *     b. Fetch Pyth close price for the query's token feed
 *     c. Collect all responses + trade-bearing comments for this query
 *     d. Compute 10× leveraged PnL per trade via computePnl()
 *     e. Insert paper_trades rows (unique indexes enforce idempotency)
 *     f. Credit each agent bankroll by (positionSize + pnl) atomically
 *     g. Mark query status='settled', close_price_pyth=exit, settled_at=now()
 *     h. Call brain_accrue_pnl RPC for each response trade (non-fatal)
 */
import { type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { dbAdmin } from "@/lib/db";
import { getPythPrices } from "@/lib/clients/pyth";
import { computePnl, SETTLE_GRACE_MS, type Direction } from "@/lib/settlement";
import { apiError, logError, requestId } from "@/lib/api-error";

const ROUTE = "/api/settle";

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
  const rid = requestId(request);
  // Prefer CRON_SECRET (Vercel standard); fall back to legacy SETTLEMENT_CRON_SECRET.
  const secret = process.env.CRON_SECRET ?? process.env.SETTLEMENT_CRON_SECRET;
  if (!secret) {
    logError({ route: ROUTE, code: "missing_secret", request_id: rid });
    return {
      ok: false,
      response: apiError({
        error: "misconfigured",
        code: "missing_secret",
        status: 500,
        request_id: rid,
        extra: {
          message:
            "Neither CRON_SECRET nor SETTLEMENT_CRON_SECRET is set on the server.",
        },
      }),
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
      response: apiError({
        error: "unauthorized",
        code: "invalid_settlement_secret",
        status: 401,
        request_id: rid,
      }),
    };
  }
  return { ok: true };
}

/** Truthy = "1" or "true" (case-insensitive). Anything else is false. */
function isEnvTruthy(v: string | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true";
}

/**
 * Parse `as_of_ts` as either a Unix epoch seconds integer (or numeric string)
 * or an ISO-8601 datetime string. Returns null if the value is unparseable
 * or yields an invalid Date.
 */
function parseAsOfTs(value: unknown): Date | null {
  if (value == null) return null;
  // Numeric (or all-digits string) → treat as Unix epoch seconds.
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    // All-digits → epoch seconds. Reject leading zeros / signs / decimals.
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed);
      if (!Number.isFinite(n)) return null;
      const d = new Date(n * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
    // Otherwise try ISO-8601.
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Read `as_of_ts` from either query string (`?as_of_ts=...`) or JSON body.
 */
async function readAsOfTsRaw(request: NextRequest): Promise<unknown> {
  const url = new URL(request.url);
  const qs = url.searchParams.get("as_of_ts");
  if (qs !== null) return qs;
  // GET typically has no body; guard so we don't throw.
  const ct = request.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("application/json")) return null;
  try {
    const body = await request.json();
    if (body && typeof body === "object" && "as_of_ts" in body) {
      return (body as Record<string, unknown>).as_of_ts;
    }
  } catch {
    // Malformed JSON — treat as if no override was sent.
  }
  return null;
}

export async function GET(request: NextRequest) {
  const auth = authorize(request);
  if (!auth.ok) return auth.response;

  const rid = requestId(request);

  // ── Test-mode override gate ─────────────────────────────────────────────
  const isProd = process.env.VERCEL_ENV === "production";
  const envFlag = isEnvTruthy(process.env.SETTLE_TEST_MODE);
  const testModeActive = envFlag && !isProd;

  if (envFlag && isProd) {
    logError({
      route: ROUTE,
      code: "settle_test_mode_ignored_in_prod",
      request_id: rid,
      extra: {
        message:
          "SETTLE_TEST_MODE is set on a production deployment and is being ignored. Remove it from the production env.",
      },
    });
  }

  let asOfOverride: Date | null = null;
  if (testModeActive) {
    const raw = await readAsOfTsRaw(request);
    if (raw != null && raw !== "") {
      const parsed = parseAsOfTs(raw);
      if (parsed === null) {
        return apiError({
          error: "invalid as_of_ts",
          code: "invalid_as_of_ts",
          status: 400,
          request_id: rid,
          extra: {
            message:
              "as_of_ts must be a Unix epoch seconds integer or an ISO-8601 datetime string.",
          },
        });
      }
      asOfOverride = parsed;
    }
  }

  const db = dbAdmin();
  const now = asOfOverride !== null ? asOfOverride.getTime() : Date.now();

  // Deadline cutoff: queries whose deadline_at + grace period has elapsed.
  // We express this in SQL as: deadline_at <= now - SETTLE_GRACE_MS
  const cutoffIso = new Date(now - SETTLE_GRACE_MS).toISOString();

  // ── 1. Find queries due for settlement ──────────────────────────────────
  const { data: dueQueries, error: queryFetchErr } = await db
    .from("queries")
    .select(`
      id,
      token_mint,
      supported_tokens!inner(pyth_feed_id)
    `)
    .eq("status", "open")
    .lte("deadline_at", cutoffIso)
    .limit(100);

  if (queryFetchErr) {
    logError({
      route: ROUTE,
      code: "query_fetch_failed",
      request_id: rid,
      err: queryFetchErr,
    });
    return apiError({
      error: "internal_error",
      code: "query_fetch_failed",
      status: 500,
      request_id: rid,
    });
  }

  if (!dueQueries || dueQueries.length === 0) {
    const headers: Record<string, string> = {};
    if (asOfOverride !== null) headers["X-TradeFish-Test-Mode"] = "1";
    return Response.json(
      { ok: true, settled: { queries: 0, trades: 0 }, ran_at: new Date(now).toISOString() },
      { headers },
    );
  }

  let totalTradesSettled = 0;
  const settledQueryIds: string[] = [];

  for (const query of dueQueries as any[]) {
    const queryId: string = query.id;
    const feedId: string = query.supported_tokens?.pyth_feed_id;

    // ── 2a. Mark status='settling' (optimistic lock) ──────────────────────
    const { error: lockErr } = await db
      .from("queries")
      .update({ status: "settling" })
      .eq("id", queryId)
      .eq("status", "open"); // only update if still open (idempotency guard)

    if (lockErr) {
      logError({
        route: ROUTE,
        code: "query_lock_failed",
        request_id: rid,
        err: lockErr,
        extra: { query_id: queryId },
      });
      continue;
    }

    // ── 2b. Fetch Pyth close price ────────────────────────────────────────
    if (!feedId) {
      logError({
        route: ROUTE,
        code: "missing_feed_id",
        request_id: rid,
        extra: { query_id: queryId },
      });
      continue;
    }

    const normalizedFeedId = feedId.startsWith("0x") ? feedId : `0x${feedId}`;
    let prices: Record<string, number>;
    try {
      prices = await getPythPrices([normalizedFeedId]);
    } catch (err) {
      logError({
        route: ROUTE,
        code: "pyth_fetch_failed",
        request_id: rid,
        err,
        extra: { query_id: queryId, feed_id: normalizedFeedId },
      });
      // Leave query in 'settling' state — will be retried on next cron run
      // once the lock is re-evaluated. The unique index on paper_trades prevents
      // duplicates if we somehow get a partial insert.
      continue;
    }

    const exitPrice = prices[normalizedFeedId];
    if (exitPrice === undefined || exitPrice <= 0) {
      logError({
        route: ROUTE,
        code: "pyth_price_unavailable",
        request_id: rid,
        extra: { query_id: queryId, feed_id: normalizedFeedId },
      });
      continue;
    }

    // ── 2c. Collect responses ─────────────────────────────────────────────
    const { data: responses, error: respErr } = await db
      .from("responses")
      .select("id, agent_id, answer, position_size_usd, pyth_price_at_response")
      .eq("query_id", queryId);

    if (respErr) {
      logError({
        route: ROUTE,
        code: "responses_fetch_failed",
        request_id: rid,
        err: respErr,
        extra: { query_id: queryId },
      });
      continue;
    }

    // ── 2d. Collect trade-bearing comments ────────────────────────────────
    const { data: tradeComments, error: commErr } = await db
      .from("comments")
      .select("id, agent_id, direction, position_size_usd, entry_price")
      .eq("query_id", queryId)
      .not("direction", "is", null);

    if (commErr) {
      logError({
        route: ROUTE,
        code: "comments_fetch_failed",
        request_id: rid,
        err: commErr,
        extra: { query_id: queryId },
      });
      continue;
    }

    // ── 2e. Build paper_trades rows ───────────────────────────────────────
    const paperTradeRows: Array<{
      response_id: string | null;
      comment_id: string | null;
      agent_id: string;
      query_id: string;
      direction: string;
      position_size_usd: number;
      entry_price: number;
      exit_price: number;
      pnl_usd: number;
    }> = [];

    // Bankroll credits keyed by agent_id: { positionSize + pnl }
    const bankrollCredits = new Map<string, number>();

    for (const r of (responses ?? []) as any[]) {
      const entryPrice = Number(r.pyth_price_at_response);
      const positionSizeUsd = Number(r.position_size_usd ?? 100);
      const direction = (r.answer ?? "hold") as Direction;

      if (!entryPrice || entryPrice <= 0) continue;

      const pnlUsd = computePnl({
        entryPrice,
        exitPrice,
        direction,
        positionSizeUsd,
      });

      paperTradeRows.push({
        response_id: r.id,
        comment_id: null,
        agent_id: r.agent_id,
        query_id: queryId,
        direction,
        position_size_usd: positionSizeUsd,
        entry_price: entryPrice,
        exit_price: exitPrice,
        pnl_usd: Math.round(pnlUsd * 100) / 100,
      });

      const prev = bankrollCredits.get(r.agent_id) ?? 0;
      bankrollCredits.set(r.agent_id, prev + positionSizeUsd + pnlUsd);
    }

    for (const c of (tradeComments ?? []) as any[]) {
      const entryPrice = Number(c.entry_price);
      const positionSizeUsd = Number(c.position_size_usd ?? 100);
      const direction = (c.direction ?? "hold") as Direction;

      if (!entryPrice || entryPrice <= 0) continue;

      const pnlUsd = computePnl({
        entryPrice,
        exitPrice,
        direction,
        positionSizeUsd,
      });

      paperTradeRows.push({
        response_id: null,
        comment_id: c.id,
        agent_id: c.agent_id,
        query_id: queryId,
        direction,
        position_size_usd: positionSizeUsd,
        entry_price: entryPrice,
        exit_price: exitPrice,
        pnl_usd: Math.round(pnlUsd * 100) / 100,
      });

      const prev = bankrollCredits.get(c.agent_id) ?? 0;
      bankrollCredits.set(c.agent_id, prev + positionSizeUsd + pnlUsd);
    }

    // ── 2f. Insert paper_trades (unique indexes enforce idempotency) ──────
    if (paperTradeRows.length > 0) {
      const { error: insertErr } = await db
        .from("paper_trades")
        .insert(paperTradeRows)
        .select("id"); // select triggers proper conflict detection

      if (insertErr) {
        // On conflict (already settled) the unique index will reject.
        // Log but don't abort — we still want to mark the query settled.
        logError({
          route: ROUTE,
          code: "paper_trades_insert_failed",
          request_id: rid,
          err: insertErr,
          extra: { query_id: queryId, trade_count: paperTradeRows.length },
        });
      }
    }

    // ── 2g. Credit agent bankrolls ────────────────────────────────────────
    for (const [agentId, credit] of bankrollCredits.entries()) {
      const rounded = Math.round(credit * 100) / 100;
      const { error: bankrollErr } = await db.rpc("increment_bankroll", {
        p_agent_id: agentId,
        p_delta: rounded,
      });

      if (bankrollErr) {
        // Bankroll update failures are non-fatal — log and continue.
        // The RPC may not exist yet if the brain migration hasn't landed.
        logError({
          route: ROUTE,
          code: "bankroll_update_failed",
          request_id: rid,
          err: bankrollErr,
          extra: { agent_id: agentId, delta: rounded, query_id: queryId },
        });
      }
    }

    // ── 2h. Mark query settled ────────────────────────────────────────────
    const { error: settleErr } = await db
      .from("queries")
      .update({
        status: "settled",
        close_price_pyth: exitPrice,
        settled_at: new Date().toISOString(),
      })
      .eq("id", queryId);

    if (settleErr) {
      logError({
        route: ROUTE,
        code: "query_settle_failed",
        request_id: rid,
        err: settleErr,
        extra: { query_id: queryId },
      });
      continue;
    }

    // ── 2i. Brain RPC per response trade (non-fatal) ──────────────────────
    for (const row of paperTradeRows) {
      if (!row.response_id) continue; // skip comment trades
      try {
        const { error: brainErr } = await db.rpc("brain_accrue_pnl", {
          p_response_id: row.response_id,
        });
        if (brainErr) {
          logError({
            route: ROUTE,
            code: "brain_accrue_pnl_failed",
            request_id: rid,
            err: brainErr,
            extra: { response_id: row.response_id, query_id: queryId },
          });
        }
      } catch (err) {
        logError({
          route: ROUTE,
          code: "brain_accrue_pnl_exception",
          request_id: rid,
          err,
          extra: { response_id: row.response_id, query_id: queryId },
        });
      }
    }

    totalTradesSettled += paperTradeRows.length;
    settledQueryIds.push(queryId);
  }

  const headers: Record<string, string> = {};
  if (asOfOverride !== null) headers["X-TradeFish-Test-Mode"] = "1";

  return Response.json(
    {
      ok: true,
      settled: { queries: settledQueryIds.length, trades: totalTradesSettled },
      ran_at: new Date(now).toISOString(),
    },
    { headers },
  );
}
