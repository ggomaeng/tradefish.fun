/**
 * Vercel Cron: settle responses whose 1h / 4h / 24h windows have elapsed.
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
 *    or query string, overriding `Date.now()` for window-eligibility checks.
 *  - Production NEVER honors `as_of_ts`, even if `SETTLE_TEST_MODE` is set
 *    on the production env. A warning is logged in that case.
 *  - When the override is honored, the response carries the response header
 *    `X-TradeFish-Test-Mode: 1` so callers (e2e fixture) can confirm.
 *  - When test mode is inactive, an `as_of_ts` payload field is silently
 *    ignored (no 400) — same behaviour as if it weren't there.
 *  - When test mode IS active and `as_of_ts` is malformed (not parseable as
 *    Unix epoch seconds OR ISO-8601), the handler returns 400 + invalid_as_of_ts.
 */
import { type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { dbAdmin } from "@/lib/db";
import { getPythPrices } from "@/lib/clients/pyth";
import { computeSettlement, WINDOWS, WINDOW_MS, type Window, type Answer } from "@/lib/settlement";
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
 * GET requests typically use the query string; we also tolerate a JSON body
 * for parity with how the e2e fixture might POST-shaped overrides through
 * the same endpoint in test rigs. Body parse errors are swallowed (treat as
 * absent) — the per-spec rule is "silently ignored when test mode inactive";
 * when test mode IS active, an absent value still means "use Date.now()".
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

  // ── Test-mode override gate ────────────────────────────────────────────────
  // Non-prod iff VERCEL_ENV is anything other than the literal "production".
  // (`'preview'`, `'development'`, undefined → non-prod.)
  const isProd = process.env.VERCEL_ENV === "production";
  const envFlag = isEnvTruthy(process.env.SETTLE_TEST_MODE);
  const testModeActive = envFlag && !isProd;

  if (envFlag && isProd) {
    // Defensive: the env flag was set on a production deploy. We refuse to
    // honor as_of_ts but want loud signal that someone misconfigured.
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
      logError({ route: ROUTE, code: "settle_fetch_failed", request_id: rid, err: error, extra: { window } });
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
        logError({ route: ROUTE, code: "settle_insert_failed", request_id: rid, err: insErr, extra: { window } });
      } else {
        summary[window] = rows.length;
      }
    }
  }

  const headers: Record<string, string> = {};
  if (asOfOverride !== null) {
    // Only set when the override was actually honored — production paths
    // never see this header even if SETTLE_TEST_MODE was set.
    headers["X-TradeFish-Test-Mode"] = "1";
  }
  return Response.json(
    { ok: true, settled: summary, ran_at: new Date(now).toISOString() },
    { headers },
  );
}
