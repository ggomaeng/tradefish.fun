/**
 * /api/settle auth gate tests.
 *
 * Verifies the secret enforcement contract:
 *  - missing Authorization header               → 401 invalid_settlement_secret
 *  - wrong Bearer value                         → 401 invalid_settlement_secret
 *  - neither CRON_SECRET nor SETTLEMENT_CRON_SECRET set → 500 missing_secret
 *  - CRON_SECRET set (Vercel standard)          → handler runs (200)
 *  - SETTLEMENT_CRON_SECRET set (legacy)        → handler runs (200)
 *
 * Downstream calls (Supabase, Pyth) are mocked to a "no work to do" path so
 * the test doesn't need a real DB or network.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { randomBytes } from "node:crypto";

// Mock Supabase to return zero rows for every windowed fetch. The route
// short-circuits on empty `due` so no Pyth call is needed in the happy path.
vi.mock("@/lib/db", () => ({
  dbAdmin: () => ({
    from: (_table: string) => ({
      select: (_cols: string) => ({
        lte: (_col: string, _val: unknown) => ({
          limit: async (_n: number) => ({ data: [], error: null }),
        }),
      }),
    }),
  }),
}));

// Defensive: stub Pyth too in case the route ever changes shape.
vi.mock("@/lib/clients/pyth", () => ({
  getPythPrices: vi.fn(async () => ({})),
}));

const SECRET = "settle_test_" + randomBytes(16).toString("hex");
let savedCronSecret: string | undefined;
let savedSettlementSecret: string | undefined;
let savedTestMode: string | undefined;
let savedVercelEnv: string | undefined;

beforeAll(() => {
  savedCronSecret = process.env.CRON_SECRET;
  savedSettlementSecret = process.env.SETTLEMENT_CRON_SECRET;
  savedTestMode = process.env.SETTLE_TEST_MODE;
  savedVercelEnv = process.env.VERCEL_ENV;
});

afterAll(() => {
  if (savedCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = savedCronSecret;
  if (savedSettlementSecret === undefined) delete process.env.SETTLEMENT_CRON_SECRET;
  else process.env.SETTLEMENT_CRON_SECRET = savedSettlementSecret;
  if (savedTestMode === undefined) delete process.env.SETTLE_TEST_MODE;
  else process.env.SETTLE_TEST_MODE = savedTestMode;
  if (savedVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = savedVercelEnv;
});

beforeEach(() => {
  // Use the legacy var by default so existing tests are unchanged.
  delete process.env.CRON_SECRET;
  process.env.SETTLEMENT_CRON_SECRET = SECRET;
  // Clean slate on every test — each test opts into the test-mode env it needs.
  delete process.env.SETTLE_TEST_MODE;
  delete process.env.VERCEL_ENV;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function buildRequest(
  headers: Record<string, string> = {},
  opts: { url?: string; method?: string; body?: BodyInit } = {},
): Request {
  return new Request(opts.url ?? "http://localhost/api/settle", {
    method: opts.method ?? "GET",
    headers,
    body: opts.body,
  });
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { authorization: `Bearer ${SECRET}`, ...extra };
}

describe("GET /api/settle — auth gate", () => {
  it("returns 401 when the Authorization header is missing", async () => {
    const { GET } = await import("./route");
    const res = await GET(buildRequest() as never);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
    expect(body.code).toBe("invalid_settlement_secret");
    expect(typeof body.request_id).toBe("string");
    expect(body.request_id.length).toBeGreaterThan(0);
  });

  it("returns 401 when the Bearer secret is wrong", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      buildRequest({ authorization: "Bearer not-the-real-secret" }) as never,
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
    expect(body.code).toBe("invalid_settlement_secret");
  });

  it("returns 401 when the secret prefix is right but value is wrong (same length)", async () => {
    // Construct a wrong value with the SAME length as the real Bearer string
    // so we hit the timingSafeEqual branch (not the length-mismatch branch).
    const wrong = "x".repeat(SECRET.length);
    const { GET } = await import("./route");
    const res = await GET(
      buildRequest({ authorization: `Bearer ${wrong}` }) as never,
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("invalid_settlement_secret");
  });

  it("returns 500 when neither CRON_SECRET nor SETTLEMENT_CRON_SECRET is set", async () => {
    delete process.env.CRON_SECRET;
    delete process.env.SETTLEMENT_CRON_SECRET;
    const { GET } = await import("./route");
    const res = await GET(
      buildRequest({ authorization: `Bearer ${SECRET}` }) as never,
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("misconfigured");
    expect(body.code).toBe("missing_secret");
    expect(typeof body.request_id).toBe("string");
    // Error message should mention both var names (extra is spread to top level).
    expect(body.message).toContain("CRON_SECRET");
    expect(body.message).toContain("SETTLEMENT_CRON_SECRET");
  });

  it("runs the handler when the Bearer secret matches SETTLEMENT_CRON_SECRET (legacy)", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      buildRequest({ authorization: `Bearer ${SECRET}` }) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // No rows in the mocked DB → every window settled zero responses.
    expect(body.settled).toEqual({ "1h": 0, "4h": 0, "24h": 0 });
    expect(typeof body.ran_at).toBe("string");
  });

  it("runs the handler when the Bearer secret matches CRON_SECRET (Vercel standard)", async () => {
    // CRON_SECRET takes priority over SETTLEMENT_CRON_SECRET.
    const cronSecret = "cron_test_" + randomBytes(16).toString("hex");
    process.env.CRON_SECRET = cronSecret;
    // Set a different legacy secret so we can confirm CRON_SECRET is what matched.
    process.env.SETTLEMENT_CRON_SECRET = "should-not-match";
    const { GET } = await import("./route");
    const res = await GET(
      buildRequest({ authorization: `Bearer ${cronSecret}` }) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.settled).toEqual({ "1h": 0, "4h": 0, "24h": 0 });
  });

  it("returns 401 when CRON_SECRET is set but the Bearer value matches the legacy var instead", async () => {
    // CRON_SECRET wins; if the caller sends the old secret it should be rejected.
    process.env.CRON_SECRET = "new-cron-secret-value";
    process.env.SETTLEMENT_CRON_SECRET = SECRET; // old secret
    const { GET } = await import("./route");
    const res = await GET(
      buildRequest({ authorization: `Bearer ${SECRET}` }) as never,
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("invalid_settlement_secret");
  });
});

describe("GET /api/settle — SETTLE_TEST_MODE override", () => {
  // A fixed, "old" timestamp the route can use as if it were now. We pick a
  // distant past so we can recognize it in `ran_at` (which the route emits
  // as `new Date(now).toISOString()` — when override is honored, this equals
  // our supplied as_of_ts).
  const PAST_EPOCH_S = 1_700_000_000; // 2023-11-14T22:13:20Z
  const PAST_ISO = new Date(PAST_EPOCH_S * 1000).toISOString();

  it("ignores as_of_ts when SETTLE_TEST_MODE is unset (existing behavior)", async () => {
    // No SETTLE_TEST_MODE in env. Override is silently ignored — no 400.
    const url = `http://localhost/api/settle?as_of_ts=${PAST_EPOCH_S}`;
    const { GET } = await import("./route");
    const res = await GET(buildRequest(authHeaders(), { url }) as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-TradeFish-Test-Mode")).toBeNull();
    const body = await res.json();
    // ran_at should be ~now (post-2024), NOT the 2023 PAST_ISO we tried to pass.
    expect(body.ran_at).not.toBe(PAST_ISO);
    expect(new Date(body.ran_at).getTime()).toBeGreaterThan(
      Date.UTC(2024, 0, 1),
    );
  });

  it("ignores as_of_ts in production even when SETTLE_TEST_MODE=1", async () => {
    process.env.SETTLE_TEST_MODE = "1";
    process.env.VERCEL_ENV = "production";
    const url = `http://localhost/api/settle?as_of_ts=${PAST_EPOCH_S}`;
    const { GET } = await import("./route");
    const res = await GET(buildRequest(authHeaders(), { url }) as never);
    expect(res.status).toBe(200);
    // Production NEVER honors the override → no test-mode header.
    expect(res.headers.get("X-TradeFish-Test-Mode")).toBeNull();
    const body = await res.json();
    expect(body.ran_at).not.toBe(PAST_ISO);
    expect(new Date(body.ran_at).getTime()).toBeGreaterThan(
      Date.UTC(2024, 0, 1),
    );
  });

  it("honors as_of_ts on preview when SETTLE_TEST_MODE=1 (epoch seconds via query string)", async () => {
    process.env.SETTLE_TEST_MODE = "1";
    process.env.VERCEL_ENV = "preview";
    const url = `http://localhost/api/settle?as_of_ts=${PAST_EPOCH_S}`;
    const { GET } = await import("./route");
    const res = await GET(buildRequest(authHeaders(), { url }) as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-TradeFish-Test-Mode")).toBe("1");
    const body = await res.json();
    // The override timestamp is what the handler considered "now".
    expect(body.ran_at).toBe(PAST_ISO);
  });

  it("honors as_of_ts on preview when SETTLE_TEST_MODE=true and the value is ISO-8601 in the query string", async () => {
    process.env.SETTLE_TEST_MODE = "TRUE"; // case-insensitive
    process.env.VERCEL_ENV = "preview";
    const url = `http://localhost/api/settle?as_of_ts=${encodeURIComponent(
      PAST_ISO,
    )}`;
    const { GET } = await import("./route");
    const res = await GET(buildRequest(authHeaders(), { url }) as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-TradeFish-Test-Mode")).toBe("1");
    const body = await res.json();
    expect(body.ran_at).toBe(PAST_ISO);
  });

  it("returns 400 on preview when SETTLE_TEST_MODE=1 and as_of_ts is malformed", async () => {
    process.env.SETTLE_TEST_MODE = "1";
    process.env.VERCEL_ENV = "preview";
    const url = `http://localhost/api/settle?as_of_ts=not-a-date`;
    const { GET } = await import("./route");
    const res = await GET(buildRequest(authHeaders(), { url }) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid as_of_ts");
    expect(body.code).toBe("invalid_as_of_ts");
    expect(typeof body.request_id).toBe("string");
  });

  it("treats VERCEL_ENV='development' as non-prod (override honored)", async () => {
    process.env.SETTLE_TEST_MODE = "1";
    process.env.VERCEL_ENV = "development";
    const url = `http://localhost/api/settle?as_of_ts=${PAST_EPOCH_S}`;
    const { GET } = await import("./route");
    const res = await GET(buildRequest(authHeaders(), { url }) as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-TradeFish-Test-Mode")).toBe("1");
  });

  it("ignores as_of_ts when SETTLE_TEST_MODE is set to a non-truthy value (e.g. 'no')", async () => {
    process.env.SETTLE_TEST_MODE = "no";
    process.env.VERCEL_ENV = "preview";
    const url = `http://localhost/api/settle?as_of_ts=${PAST_EPOCH_S}`;
    const { GET } = await import("./route");
    const res = await GET(buildRequest(authHeaders(), { url }) as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-TradeFish-Test-Mode")).toBeNull();
    const body = await res.json();
    expect(body.ran_at).not.toBe(PAST_ISO);
  });
});
