/**
 * /api/settle tests — v1 per-query atomic settlement.
 *
 * Covers:
 *  - Auth gate (missing header, wrong secret, missing env vars, CRON_SECRET priority)
 *  - SETTLE_TEST_MODE override (as_of_ts via query string)
 *  - Empty queue (no queries due)
 *  - Happy path: 2 responses + 1 trade comment → 3 paper_trades, query settled
 *  - Pyth fetch error → query stays in 'settling', no crash
 *  - Idempotency: settle twice → unique-index conflict logged, no crash
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
  type Mock,
} from "vitest";
import { randomBytes } from "node:crypto";

// ── Shared mock state ────────────────────────────────────────────────────────

/** Rows returned by each .from(table).select(...) call chain */
let mockQueryRows: any[] = [];
let mockResponseRows: any[] = [];
let mockCommentRows: any[] = [];

/** Tracks insert calls so we can assert on them */
const insertedPaperTrades: any[][] = [];

/** Controls whether paper_trades insert returns an error */
let paperTradesInsertError: { message: string } | null = null;

/** Controls whether Pyth returns a price or an empty map */
let pythPriceResult: Record<string, number> = {};
let pythShouldThrow = false;

/** Controls whether RPC calls error */
let rpcError: { message: string } | null = null;

/** Tracks all RPC calls */
const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];

/** Track update calls (for asserting query status changes) */
const updateCalls: Array<{ table: string; data: Record<string, unknown>; filters: Record<string, unknown> }> = [];

function makeQueryBuilder(table: string) {
  const filters: Record<string, unknown> = {};
  let updateData: Record<string, unknown> = {};
  let selectCols = "";
  let insertRows: any[] | null = null;
  let rpcFn: string | null = null;
  let rpcArgs: Record<string, unknown> = {};
  let isInsert = false;
  let isUpdate = false;
  let isRpc = false;
  let isSelect = false;

  const self: any = {
    select(cols: string) {
      selectCols = cols;
      isSelect = true;
      return self;
    },
    insert(rows: any[]) {
      insertRows = rows;
      isInsert = true;
      return self;
    },
    update(data: Record<string, unknown>) {
      updateData = data;
      isUpdate = true;
      return self;
    },
    eq(col: string, val: unknown) {
      filters[col] = val;
      return self;
    },
    lte(col: string, val: unknown) {
      filters[`${col}:lte`] = val;
      return self;
    },
    not(col: string, _op: string, _val: unknown) {
      return self;
    },
    limit(_n: number) {
      return self;
    },
    // Resolves the promise — called when the chain is awaited
    then(resolve: (v: any) => void, reject: (e: any) => void) {
      try {
        if (isRpc) {
          rpcCalls.push({ fn: rpcFn!, args: rpcArgs });
          if (rpcError) {
            resolve({ data: null, error: rpcError });
          } else {
            resolve({ data: null, error: null });
          }
          return;
        }

        if (isInsert && table === "paper_trades") {
          insertedPaperTrades.push(insertRows ?? []);
          if (paperTradesInsertError) {
            resolve({ data: null, error: paperTradesInsertError });
          } else {
            resolve({ data: insertRows, error: null });
          }
          return;
        }

        if (isUpdate) {
          updateCalls.push({ table, data: updateData, filters });
          resolve({ data: null, error: null });
          return;
        }

        // SELECT path
        if (table === "queries") {
          resolve({ data: mockQueryRows, error: null });
          return;
        }
        if (table === "responses") {
          resolve({ data: mockResponseRows, error: null });
          return;
        }
        if (table === "comments") {
          resolve({ data: mockCommentRows, error: null });
          return;
        }

        resolve({ data: [], error: null });
      } catch (e) {
        reject(e);
      }
    },
  };

  return self;
}

vi.mock("@/lib/db", () => ({
  dbAdmin: () => ({
    from: (table: string) => makeQueryBuilder(table),
    rpc: (fn: string, args: Record<string, unknown>) => {
      const r = makeQueryBuilder("__rpc__");
      r._rpcFn = fn;
      r._rpcArgs = args;
      // Override the then to be an RPC call
      const origThen = r.then.bind(r);
      r.then = (resolve: any, reject: any) => {
        rpcCalls.push({ fn, args });
        if (rpcError) {
          resolve({ data: null, error: rpcError });
        } else {
          resolve({ data: null, error: null });
        }
      };
      return r;
    },
  }),
}));

vi.mock("@/lib/clients/pyth", () => ({
  getPythPrices: vi.fn(async (feedIds: string[]) => {
    if (pythShouldThrow) throw new Error("Pyth network error");
    return pythPriceResult;
  }),
}));

// ── Env / secret management ──────────────────────────────────────────────────

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
  delete process.env.CRON_SECRET;
  process.env.SETTLEMENT_CRON_SECRET = SECRET;
  delete process.env.SETTLE_TEST_MODE;
  delete process.env.VERCEL_ENV;

  // Reset shared state
  mockQueryRows = [];
  mockResponseRows = [];
  mockCommentRows = [];
  insertedPaperTrades.length = 0;
  updateCalls.length = 0;
  rpcCalls.length = 0;
  paperTradesInsertError = null;
  pythPriceResult = {};
  pythShouldThrow = false;
  rpcError = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Auth gate tests ──────────────────────────────────────────────────────────

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
    // Error message should mention both var names.
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
    // No queries due → zero settled
    expect(body.settled).toEqual({ queries: 0, trades: 0 });
    expect(typeof body.ran_at).toBe("string");
  });

  it("runs the handler when the Bearer secret matches CRON_SECRET (Vercel standard)", async () => {
    const cronSecret = "cron_test_" + randomBytes(16).toString("hex");
    process.env.CRON_SECRET = cronSecret;
    process.env.SETTLEMENT_CRON_SECRET = "should-not-match";
    const { GET } = await import("./route");
    const res = await GET(
      buildRequest({ authorization: `Bearer ${cronSecret}` }) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.settled).toEqual({ queries: 0, trades: 0 });
  });

  it("returns 401 when CRON_SECRET is set but the Bearer value matches the legacy var instead", async () => {
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

// ── SETTLE_TEST_MODE tests ───────────────────────────────────────────────────

describe("GET /api/settle — SETTLE_TEST_MODE override", () => {
  const PAST_EPOCH_S = 1_700_000_000; // 2023-11-14T22:13:20Z
  const PAST_ISO = new Date(PAST_EPOCH_S * 1000).toISOString();

  it("ignores as_of_ts when SETTLE_TEST_MODE is unset (existing behavior)", async () => {
    const url = `http://localhost/api/settle?as_of_ts=${PAST_EPOCH_S}`;
    const { GET } = await import("./route");
    const res = await GET(buildRequest(authHeaders(), { url }) as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-TradeFish-Test-Mode")).toBeNull();
    const body = await res.json();
    // ran_at should be ~now (post-2024), NOT the 2023 PAST_ISO.
    expect(body.ran_at).not.toBe(PAST_ISO);
    expect(new Date(body.ran_at).getTime()).toBeGreaterThan(Date.UTC(2024, 0, 1));
  });

  it("ignores as_of_ts in production even when SETTLE_TEST_MODE=1", async () => {
    process.env.SETTLE_TEST_MODE = "1";
    process.env.VERCEL_ENV = "production";
    const url = `http://localhost/api/settle?as_of_ts=${PAST_EPOCH_S}`;
    const { GET } = await import("./route");
    const res = await GET(buildRequest(authHeaders(), { url }) as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-TradeFish-Test-Mode")).toBeNull();
    const body = await res.json();
    expect(body.ran_at).not.toBe(PAST_ISO);
    expect(new Date(body.ran_at).getTime()).toBeGreaterThan(Date.UTC(2024, 0, 1));
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
    expect(body.ran_at).toBe(PAST_ISO);
  });

  it("honors as_of_ts on preview when SETTLE_TEST_MODE=true and the value is ISO-8601", async () => {
    process.env.SETTLE_TEST_MODE = "TRUE";
    process.env.VERCEL_ENV = "preview";
    const url = `http://localhost/api/settle?as_of_ts=${encodeURIComponent(PAST_ISO)}`;
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

// ── Empty queue ──────────────────────────────────────────────────────────────

describe("GET /api/settle — empty queue", () => {
  it("returns ok with 0 settled when no queries are due", async () => {
    // mockQueryRows already = [] from beforeEach
    const { GET } = await import("./route");
    const res = await GET(buildRequest(authHeaders()) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.settled.queries).toBe(0);
    expect(body.settled.trades).toBe(0);
    expect(insertedPaperTrades.length).toBe(0);
  });
});

// ── Happy path ───────────────────────────────────────────────────────────────

describe("GET /api/settle — happy path", () => {
  const QUERY_ID = "query-uuid-1";
  const AGENT_A = "agent-uuid-a";
  const AGENT_B = "agent-uuid-b";
  const RESP_1 = "resp-uuid-1";
  const RESP_2 = "resp-uuid-2";
  const COMMENT_1 = "comment-uuid-1";
  const FEED_ID = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
  const ENTRY_PRICE = 100;
  const EXIT_PRICE = 110; // +10%

  beforeEach(() => {
    mockQueryRows = [
      {
        id: QUERY_ID,
        token_mint: "So11111111111111111111111111111111111111112",
        supported_tokens: { pyth_feed_id: FEED_ID },
      },
    ];

    mockResponseRows = [
      {
        id: RESP_1,
        agent_id: AGENT_A,
        answer: "buy",
        position_size_usd: 100,
        pyth_price_at_response: ENTRY_PRICE,
      },
      {
        id: RESP_2,
        agent_id: AGENT_B,
        answer: "sell",
        position_size_usd: 50,
        pyth_price_at_response: ENTRY_PRICE,
      },
    ];

    mockCommentRows = [
      {
        id: COMMENT_1,
        agent_id: AGENT_A,
        direction: "buy",
        position_size_usd: 200,
        entry_price: ENTRY_PRICE,
      },
    ];

    pythPriceResult = { [FEED_ID]: EXIT_PRICE };
  });

  it("inserts 3 paper_trades (2 responses + 1 comment)", async () => {
    const { GET } = await import("./route");
    const res = await GET(buildRequest(authHeaders()) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.settled.trades).toBe(3);
    expect(body.settled.queries).toBe(1);

    expect(insertedPaperTrades.length).toBe(1);
    const trades = insertedPaperTrades[0];
    expect(trades.length).toBe(3);
  });

  it("response trade has correct response_id and null comment_id", async () => {
    const { GET } = await import("./route");
    await GET(buildRequest(authHeaders()) as never);
    const trades = insertedPaperTrades[0];
    const resp1Trade = trades.find((t: any) => t.response_id === RESP_1);
    expect(resp1Trade).toBeDefined();
    expect(resp1Trade.comment_id).toBeNull();
    expect(resp1Trade.agent_id).toBe(AGENT_A);
    expect(resp1Trade.direction).toBe("buy");
    expect(resp1Trade.query_id).toBe(QUERY_ID);
    expect(resp1Trade.exit_price).toBe(EXIT_PRICE);
  });

  it("comment trade has correct comment_id and null response_id", async () => {
    const { GET } = await import("./route");
    await GET(buildRequest(authHeaders()) as never);
    const trades = insertedPaperTrades[0];
    const commentTrade = trades.find((t: any) => t.comment_id === COMMENT_1);
    expect(commentTrade).toBeDefined();
    expect(commentTrade.response_id).toBeNull();
    expect(commentTrade.direction).toBe("buy");
  });

  it("buy trade with +10% move at 10x on $100 position → $100 PnL", async () => {
    const { GET } = await import("./route");
    await GET(buildRequest(authHeaders()) as never);
    const trades = insertedPaperTrades[0];
    const resp1 = trades.find((t: any) => t.response_id === RESP_1);
    // $100 * (110-100)/100 * 1 * 10 = $100
    expect(resp1.pnl_usd).toBeCloseTo(100, 1);
  });

  it("sell trade with +10% move at 10x on $50 position → -$50 PnL", async () => {
    const { GET } = await import("./route");
    await GET(buildRequest(authHeaders()) as never);
    const trades = insertedPaperTrades[0];
    const resp2 = trades.find((t: any) => t.response_id === RESP_2);
    // $50 * (110-100)/100 * -1 * 10 = -$50
    expect(resp2.pnl_usd).toBeCloseTo(-50, 1);
  });

  it("marks query as settled in the update calls", async () => {
    const { GET } = await import("./route");
    await GET(buildRequest(authHeaders()) as never);
    const settleCall = updateCalls.find(
      (c) => c.table === "queries" && c.data.status === "settled",
    );
    expect(settleCall).toBeDefined();
    expect(settleCall!.data.close_price_pyth).toBe(EXIT_PRICE);
    expect(settleCall!.data.settled_at).toBeDefined();
  });

  it("calls brain_accrue_pnl for each response trade (not comment trades)", async () => {
    const { GET } = await import("./route");
    await GET(buildRequest(authHeaders()) as never);
    const brainCalls = rpcCalls.filter((c) => c.fn === "brain_accrue_pnl");
    // 2 responses → 2 brain calls
    expect(brainCalls.length).toBe(2);
    const responseIds = brainCalls.map((c) => c.args.p_response_id);
    expect(responseIds).toContain(RESP_1);
    expect(responseIds).toContain(RESP_2);
  });
});

// ── Pyth fetch error ──────────────────────────────────────────────────────────

describe("GET /api/settle — Pyth fetch error", () => {
  const QUERY_ID = "query-uuid-pyth-err";
  const FEED_ID = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

  beforeEach(() => {
    mockQueryRows = [
      {
        id: QUERY_ID,
        token_mint: "So11111111111111111111111111111111111111112",
        supported_tokens: { pyth_feed_id: FEED_ID },
      },
    ];
    mockResponseRows = [
      {
        id: "resp-uuid-p1",
        agent_id: "agent-uuid-p1",
        answer: "buy",
        position_size_usd: 100,
        pyth_price_at_response: 100,
      },
    ];
    mockCommentRows = [];
    pythShouldThrow = true;
  });

  it("does not crash when Pyth throws", async () => {
    const { GET } = await import("./route");
    const res = await GET(buildRequest(authHeaders()) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("does not insert paper_trades when Pyth fails", async () => {
    const { GET } = await import("./route");
    await GET(buildRequest(authHeaders()) as never);
    expect(insertedPaperTrades.length).toBe(0);
  });

  it("does not mark query as settled when Pyth fails", async () => {
    const { GET } = await import("./route");
    await GET(buildRequest(authHeaders()) as never);
    const settleCall = updateCalls.find(
      (c) => c.table === "queries" && c.data.status === "settled",
    );
    expect(settleCall).toBeUndefined();
  });
});

// ── Idempotency ──────────────────────────────────────────────────────────────

describe("GET /api/settle — idempotency", () => {
  const QUERY_ID = "query-uuid-idem";
  const FEED_ID = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

  beforeEach(() => {
    mockQueryRows = [
      {
        id: QUERY_ID,
        token_mint: "So11111111111111111111111111111111111111112",
        supported_tokens: { pyth_feed_id: FEED_ID },
      },
    ];
    mockResponseRows = [
      {
        id: "resp-uuid-i1",
        agent_id: "agent-uuid-i1",
        answer: "buy",
        position_size_usd: 100,
        pyth_price_at_response: 100,
      },
    ];
    mockCommentRows = [];
    pythPriceResult = { [FEED_ID]: 110 };
    // Simulate the unique index rejecting duplicate inserts on the second call
    // (first call succeeds, second call would get a conflict error)
  });

  it("second call with insert conflict error does not crash", async () => {
    const { GET } = await import("./route");

    // First call succeeds normally
    const res1 = await GET(buildRequest(authHeaders()) as never);
    expect(res1.status).toBe(200);

    // Second call: simulate unique index conflict
    paperTradesInsertError = { message: 'duplicate key value violates unique constraint "uq_paper_trades_response"' };

    const res2 = await GET(buildRequest(authHeaders()) as never);
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.ok).toBe(true);
  });

  it("brain accrue failure does not prevent settlement", async () => {
    rpcError = { message: "function brain_accrue_pnl does not exist" };
    const { GET } = await import("./route");
    const res = await GET(buildRequest(authHeaders()) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // Query should still be marked settled despite brain RPC failure
    const settleCall = updateCalls.find(
      (c) => c.table === "queries" && c.data.status === "settled",
    );
    expect(settleCall).toBeDefined();
  });
});
