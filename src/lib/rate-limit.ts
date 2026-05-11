/**
 * Rate-limit helper backed by the Supabase `rate_limits` table.
 *
 * Decision: fixed-window counter keyed on (subject, route, window_start).
 * `window_start` is the floor of `now()` to the nearest `window_seconds`. Each
 * call increments the counter for the current window; if the resulting count
 * exceeds `max_count` we reject.
 *
 * Failure mode: fail-open. If the database errors (network, RLS, missing
 * table during a half-applied migration), we LOG and allow the request. A
 * rate-limiter that hard-fails closed would convert an infrastructure
 * hiccup into a full outage; this is the lower-risk choice (RUNBOOK §3).
 *
 * Subject choice: callers pass either a wallet pubkey (when the request is
 * wallet-authenticated) or the request IP. `subjectFromRequest` is the
 * canonical helper for the IP fallback — handles X-Forwarded-For correctly
 * on Vercel.
 *
 * Returns:
 *   { ok: true,  remaining }
 *   { ok: false, retryAfter, limit, windowSeconds }
 *
 * Where `retryAfter` is integer seconds until the current window ends — fit
 * for use in an HTTP `Retry-After` header.
 */

import { dbAdmin } from "@/lib/db";

export type RateLimitResult =
  | { ok: true; remaining: number }
  | {
      ok: false;
      retryAfter: number;
      limit: number;
      windowSeconds: number;
    };

export interface EnforceArgs {
  subject: string;
  route: string;
  window_seconds?: number;
  max_count?: number;
}

const DEFAULT_WINDOW_SECONDS = 60;
const DEFAULT_MAX_COUNT = 10;

export async function enforce(args: EnforceArgs): Promise<RateLimitResult> {
  const windowSeconds = args.window_seconds ?? DEFAULT_WINDOW_SECONDS;
  const maxCount = args.max_count ?? DEFAULT_MAX_COUNT;
  const subject = args.subject?.trim();
  const route = args.route?.trim();

  // Defensive: a missing subject should never block. Treat as allow.
  if (!subject || !route) {
    return { ok: true, remaining: maxCount };
  }

  const nowMs = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStartMs = Math.floor(nowMs / windowMs) * windowMs;
  const windowStartIso = new Date(windowStartMs).toISOString();
  const retryAfter = Math.max(1, Math.ceil((windowStartMs + windowMs - nowMs) / 1000));

  const db = dbAdmin();

  try {
    // Read-current-then-write. Two queries; not transactional. The race window
    // is small and the consequence of losing a race is at most off-by-one
    // (slightly over-permissive) — acceptable for a rate-limiter at this scale.
    const { data: row, error: selectErr } = await db
      .from("rate_limits")
      .select("count")
      .eq("subject", subject)
      .eq("route", route)
      .eq("window_start", windowStartIso)
      .maybeSingle();

    if (selectErr) {
      console.error("[rate-limit] select failed (failing open):", selectErr.message);
      return { ok: true, remaining: maxCount };
    }

    const currentCount = row?.count ?? 0;
    if (currentCount >= maxCount) {
      return { ok: false, retryAfter, limit: maxCount, windowSeconds };
    }

    const nextCount = currentCount + 1;
    const { error: upsertErr } = await db
      .from("rate_limits")
      .upsert(
        {
          subject,
          route,
          window_start: windowStartIso,
          count: nextCount,
        },
        { onConflict: "subject,route,window_start" },
      );

    if (upsertErr) {
      console.error("[rate-limit] upsert failed (failing open):", upsertErr.message);
      return { ok: true, remaining: maxCount };
    }

    return { ok: true, remaining: Math.max(0, maxCount - nextCount) };
  } catch (err) {
    console.error("[rate-limit] unexpected error (failing open):", err);
    return { ok: true, remaining: maxCount };
  }
}

/**
 * Resolve a stable subject from the request:
 *   - prefers an explicit wallet pubkey (caller-supplied — already validated)
 *   - falls back to the first IP in X-Forwarded-For
 *   - falls back to X-Real-IP, then "unknown"
 *
 * On Vercel, X-Forwarded-For is set; the first hop is the original client.
 */
export function subjectFromRequest(
  request: Request,
  walletPubkey?: string | null,
): string {
  if (walletPubkey && walletPubkey.length > 0) return `wallet:${walletPubkey}`;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return `ip:${first}`;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return `ip:${real.trim()}`;
  return "ip:unknown";
}

/**
 * Build a stable request_id for error responses. Not cryptographic — just an
 * opaque correlation token that a user can quote in a bug report.
 */
export function requestId(): string {
  // 12 hex chars from random; sufficient for correlation in logs.
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Build the canonical 429 response body + headers per RUNBOOK §3.
 */
export function rateLimitedResponse(result: Extract<RateLimitResult, { ok: false }>): Response {
  const rid = requestId();
  return Response.json(
    {
      error: "rate_limited",
      code: "rate_limited",
      message: `Too many requests. Retry in ${result.retryAfter}s.`,
      request_id: rid,
      retry_after_seconds: result.retryAfter,
      limit: result.limit,
      window_seconds: result.windowSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
        "X-Request-Id": rid,
      },
    },
  );
}
