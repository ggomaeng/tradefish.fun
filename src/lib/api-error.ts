/**
 * Canonical error response shape + structured logger for all /api routes.
 *
 * Every error Response from a route should carry exactly this shape:
 *   { error: string, code: string, request_id: string, ...extra }
 *
 *   - `error`        machine-readable error category ("validation_failed", "unauthorized", ...)
 *   - `code`         finer-grained code for the specific failure path
 *   - `request_id`   correlation token; always also surfaced as `X-Request-Id` header
 *
 * Optional `extra` may carry route-specific context (issues from zod, balance,
 * required lamports, etc.) — but the three core fields are non-negotiable.
 *
 * `requestId(req?)` derives the id from an inbound `x-request-id` header when
 * present (so a client/tracer can stitch logs across hops); otherwise it
 * generates a fresh UUID. Workers/loops can therefore correlate a user-visible
 * error to a single line in the structured log.
 *
 * `logError(...)` writes a single JSON line to stderr. The fixed schema makes
 * the logs grep-/jq-able from the Vercel function dashboard:
 *
 *   { "level":"error","route":"/api/queries","code":"create_failed",
 *     "request_id":"...","message":"...", ...extra }
 *
 * Behaviour-only contract: this helper never changes HTTP status codes or
 * auth semantics. It exists purely to unify the response *shape* and the
 * log *shape* so downstream tools can rely on them.
 */

export interface ApiErrorOpts {
  error: string;
  code: string;
  status: number;
  request_id: string;
  extra?: Record<string, unknown>;
}

/**
 * Derive a request id. Honors an inbound `x-request-id` header (lowercase
 * lookup; HTTP headers are case-insensitive and Next normalizes to lowercase)
 * so a caller-supplied trace id propagates. Otherwise generates a fresh UUID.
 */
export function requestId(req?: Request | { headers: Headers } | null): string {
  if (req && typeof (req as { headers?: Headers }).headers?.get === "function") {
    const inbound = (req as { headers: Headers }).headers.get("x-request-id");
    if (inbound && inbound.trim().length > 0) return inbound.trim();
  }
  // crypto.randomUUID is available in the Edge runtime, Node 19+, and modern
  // browsers — all of our targets. No polyfill needed.
  return crypto.randomUUID();
}

/**
 * Build a canonical error Response. Always sets `X-Request-Id` so the id is
 * accessible without parsing the body (curl -i, fetch.headers, log scrape).
 */
export function apiError(opts: ApiErrorOpts): Response {
  const { error, code, status, request_id, extra } = opts;
  const body: Record<string, unknown> = { error, code, request_id };
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      // Don't let `extra` clobber the contract fields.
      if (k === "error" || k === "code" || k === "request_id") continue;
      body[k] = v;
    }
  }
  return Response.json(body, {
    status,
    headers: { "X-Request-Id": request_id },
  });
}

export interface LogErrorOpts {
  route: string;
  code: string;
  request_id: string;
  err?: unknown;
  extra?: Record<string, unknown>;
}

/**
 * Single source for structured error logs. One JSON line per failure so the
 * Vercel/CloudWatch dashboard can be grepped (`code=...`) or piped to `jq`.
 *
 * `err` is duck-typed: we extract `.message` if present, otherwise stringify.
 * Stack traces are NOT included — they're often too large for log lines and
 * tend to leak file paths. Add them via `extra` if a specific call site
 * really needs them.
 */
export function logError(opts: LogErrorOpts): void {
  const { route, code, request_id, err, extra } = opts;
  const message =
    err == null
      ? undefined
      : err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : (() => {
              try {
                return JSON.stringify(err);
              } catch {
                return String(err);
              }
            })();
  const payload: Record<string, unknown> = {
    level: "error",
    route,
    code,
    request_id,
  };
  if (message !== undefined) payload.message = message;
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (k in payload) continue;
      payload[k] = v;
    }
  }
  // Single JSON line — never multi-line; never console.log (we want stderr).
  console.error(JSON.stringify(payload));
}
