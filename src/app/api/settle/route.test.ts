/**
 * /api/settle auth gate tests.
 *
 * Verifies the SETTLEMENT_CRON_SECRET enforcement contract:
 *  - missing Authorization header  → 401 invalid_settlement_secret
 *  - wrong Bearer value            → 401 invalid_settlement_secret
 *  - SETTLEMENT_CRON_SECRET unset  → 500 missing_secret
 *  - correct Bearer value          → handler runs (200 with settled summary)
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
let savedSecret: string | undefined;

beforeAll(() => {
  savedSecret = process.env.SETTLEMENT_CRON_SECRET;
});

afterAll(() => {
  if (savedSecret === undefined) delete process.env.SETTLEMENT_CRON_SECRET;
  else process.env.SETTLEMENT_CRON_SECRET = savedSecret;
});

beforeEach(() => {
  process.env.SETTLEMENT_CRON_SECRET = SECRET;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function buildRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/settle", {
    method: "GET",
    headers,
  });
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

  it("returns 500 when SETTLEMENT_CRON_SECRET is unset", async () => {
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
  });

  it("runs the handler when the Bearer secret is correct", async () => {
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
});
