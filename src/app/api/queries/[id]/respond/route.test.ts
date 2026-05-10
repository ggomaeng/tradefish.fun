/**
 * Idempotency audit tests for POST /api/queries/[id]/respond.
 *
 * What's already in production (audit findings — these tests defend the contract):
 *
 *   1. responses.UNIQUE(query_id, agent_id) (migration 0001_init.sql line 68)
 *      → Postgres rejects a second insert with the same (query, agent) with
 *        error code "23505".
 *   2. The route catches code "23505" and returns HTTP 409 {error:"already_responded"}
 *      (route.ts lines 73-75).
 *   3. No paper-trade side-effects fire on the second call: the only writes
 *      are (a) the rejected insert and (b) the agents.last_seen_at update,
 *      and the route returns BEFORE updating last_seen_at on the duplicate path.
 *
 * Refund-on-failure for the asker happens upstream in /api/queries (POST):
 *   - credits debited atomically with `where credits >= 10`
 *   - if the Pyth call or the queries insert fails, refundWalletCredits()
 *     runs once on the synchronous failure path
 *   - settlement does NOT refund askers; rounds with no responses are
 *     "no-result" by design (asker pays for the question to exist; agents
 *     either show up or they don't).
 *
 * These tests exercise the duplicate-response path. The respond route does
 * not itself touch credits, so credit refund is covered by the queries route
 * tests (separate file, future tick).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/clients/pyth", () => ({
  getPythPrice: vi.fn(async () => 100.5),
}));

// Per-test mutable state holding what the mocked supabase should return.
type MockState = {
  agentRow: { id: string } | null;
  queryRow: any | null;
  insertCalls: number;
  insertResult: () => { data: any; error: any };
  agentsUpdateCalls: number;
};

const mockState: MockState = {
  agentRow: null,
  queryRow: null,
  insertCalls: 0,
  insertResult: () => ({ data: { id: "resp-1", responded_at: new Date().toISOString() }, error: null }),
  agentsUpdateCalls: 0,
};

vi.mock("@/lib/db", () => ({
  dbAdmin: () => ({
    from: (table: string) => {
      if (table === "agents") {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, _val: unknown) => ({
              maybeSingle: async () => ({ data: mockState.agentRow, error: null }),
            }),
          }),
          // last_seen_at update path — count it so we can assert it does NOT
          // run on the duplicate path.
          update: (_payload: any) => ({
            eq: async (_col: string, _val: unknown) => {
              mockState.agentsUpdateCalls++;
              return { data: null, error: null };
            },
          }),
        };
      }
      if (table === "queries") {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, _val: unknown) => ({
              maybeSingle: async () => ({ data: mockState.queryRow, error: null }),
            }),
          }),
        };
      }
      if (table === "responses") {
        return {
          insert: (_row: any) => ({
            select: (_cols: string) => ({
              single: async () => {
                mockState.insertCalls++;
                return mockState.insertResult();
              },
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  }),
}));

import { sha256 } from "@/lib/apikey";

const API_KEY = "tf_test_key_for_idempotency";
const API_KEY_HASH = sha256(API_KEY);

function buildReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/queries/qry_test01/respond", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${API_KEY}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ id: "qry_test01" }) };

beforeEach(() => {
  mockState.agentRow = { id: "agent-uuid-1" };
  mockState.queryRow = {
    id: "query-uuid-1",
    deadline_at: new Date(Date.now() + 60_000).toISOString(),
    token_mint: "So11111111111111111111111111111111111111112",
    supported_tokens: { pyth_feed_id: "0xabc" },
  };
  mockState.insertCalls = 0;
  mockState.agentsUpdateCalls = 0;
  mockState.insertResult = () => ({
    data: { id: "resp-1", responded_at: new Date().toISOString() },
    error: null,
  });
  // Sanity: the API_KEY_HASH constant must be the digest the route checks.
  // (No supabase eq() arg assertion needed — the mock matches any.)
  void API_KEY_HASH;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/queries/[id]/respond — idempotency", () => {
  it("first response creates a row (201)", async () => {
    const { POST } = await import("./route");
    const res = await POST(buildReq({ answer: "buy", confidence: 0.7 }) as never, ctx as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.response_id).toBe("resp-1");
    expect(body.pyth_price_at_response).toBe(100.5);
    expect(mockState.insertCalls).toBe(1);
    // last_seen_at should be updated on success
    expect(mockState.agentsUpdateCalls).toBe(1);
  });

  it("second response with same (query, agent) returns 409 already_responded — DB unique constraint enforces it", async () => {
    const { POST } = await import("./route");

    // First insert succeeds, second hits the UNIQUE(query_id, agent_id) constraint.
    let call = 0;
    mockState.insertResult = () => {
      call++;
      if (call === 1) {
        return { data: { id: "resp-1", responded_at: new Date().toISOString() }, error: null };
      }
      // Postgres unique-violation; matches what supabase-js surfaces.
      return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
    };

    const res1 = await POST(buildReq({ answer: "buy", confidence: 0.7 }) as never, ctx as never);
    expect(res1.status).toBe(201);

    const res2 = await POST(buildReq({ answer: "buy", confidence: 0.7 }) as never, ctx as never);
    expect(res2.status).toBe(409);
    const body = await res2.json();
    expect(body.error).toBe("already_responded");

    // Two insert attempts, but only ONE successful response row would have been
    // created in the real DB — the second is rejected by the unique constraint.
    expect(mockState.insertCalls).toBe(2);
    // Critically: last_seen_at update must NOT fire on the duplicate path.
    // (It runs once for the successful first call only.)
    expect(mockState.agentsUpdateCalls).toBe(1);
  });

  it("returns 409 even when a different answer/confidence is submitted (no double-process)", async () => {
    const { POST } = await import("./route");

    mockState.insertResult = () =>
      ({ data: null, error: { code: "23505", message: "duplicate" } });

    const res = await POST(
      buildReq({ answer: "sell", confidence: 0.99, reasoning: "changed my mind" }) as never,
      ctx as never,
    );
    expect(res.status).toBe(409);
    expect(mockState.agentsUpdateCalls).toBe(0);
  });

  it("returns 410 deadline_passed when the query is past its deadline (no insert, no side-effects)", async () => {
    const { POST } = await import("./route");
    mockState.queryRow = {
      ...mockState.queryRow,
      deadline_at: new Date(Date.now() - 1000).toISOString(),
    };
    const res = await POST(buildReq({ answer: "buy", confidence: 0.5 }) as never, ctx as never);
    expect(res.status).toBe(410);
    expect(mockState.insertCalls).toBe(0);
    expect(mockState.agentsUpdateCalls).toBe(0);
  });

  it("returns 401 invalid_key when the bearer token doesn't match any agent", async () => {
    const { POST } = await import("./route");
    mockState.agentRow = null;
    const res = await POST(buildReq({ answer: "buy", confidence: 0.5 }) as never, ctx as never);
    expect(res.status).toBe(401);
    expect(mockState.insertCalls).toBe(0);
    expect(mockState.agentsUpdateCalls).toBe(0);
  });
});
