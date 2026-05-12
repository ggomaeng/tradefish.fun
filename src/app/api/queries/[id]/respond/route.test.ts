/**
 * Tests for POST /api/queries/[id]/respond.
 *
 * Covers:
 *  1. Idempotency: UNIQUE(query_id, agent_id) → 409 already_responded on duplicate.
 *  2. Bankroll check: 409 insufficient_bankroll when agent bankroll < position_size_usd.
 *  3. Happy path: 201 with bankroll_usd decremented.
 *  4. Missing position_size_usd → 422 validation_failed.
 *  5. Deadline-passed guard → 410 (no insert, no bankroll change).
 *  6. Invalid API key → 401.
 *
 * DB interaction note: the mock doesn't need to atomically debit (it's a mock).
 * The debit path is tested by asserting on the returned bankroll_usd value and
 * the agentsUpdateCalls counter.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/clients/pyth", () => ({
  getPythPrice: vi.fn(async () => 100.5),
}));

type MockState = {
  agentRow: { id: string; bankroll_usd: number } | null;
  queryRow: any | null;
  insertCalls: number;
  insertResult: () => { data: any; error: any };
  agentsUpdateCalls: number;
  lastAgentsUpdatePayload: Record<string, unknown> | null;
};

const mockState: MockState = {
  agentRow: null,
  queryRow: null,
  insertCalls: 0,
  insertResult: () => ({
    data: { id: "resp-1", responded_at: new Date().toISOString() },
    error: null,
  }),
  agentsUpdateCalls: 0,
  lastAgentsUpdatePayload: null,
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
          update: (payload: Record<string, unknown>) => ({
            eq: (_col: string, _val: unknown) => ({
              select: (_cols: string) => ({
                single: async () => {
                  mockState.agentsUpdateCalls++;
                  mockState.lastAgentsUpdatePayload = payload;
                  return {
                    data: { bankroll_usd: payload.bankroll_usd },
                    error: null,
                  };
                },
              }),
            }),
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

const API_KEY = "tf_test_key_for_respond";
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

const VALID_BODY = {
  answer: "buy",
  confidence: 0.7,
  position_size_usd: 100,
};

beforeEach(() => {
  mockState.agentRow = { id: "agent-uuid-1", bankroll_usd: 1000 };
  mockState.queryRow = {
    id: "query-uuid-1",
    deadline_at: new Date(Date.now() + 60_000).toISOString(),
    token_mint: "So11111111111111111111111111111111111111112",
    supported_tokens: { pyth_feed_id: "0xabc" },
  };
  mockState.insertCalls = 0;
  mockState.agentsUpdateCalls = 0;
  mockState.lastAgentsUpdatePayload = null;
  mockState.insertResult = () => ({
    data: { id: "resp-1", responded_at: new Date().toISOString() },
    error: null,
  });
  void API_KEY_HASH; // ensure sha256 runs at import time
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/queries/[id]/respond", () => {
  describe("happy path", () => {
    it("returns 201 with response_id, pyth_price_at_response, and bankroll_usd decremented", async () => {
      const { POST } = await import("./route");
      const res = await POST(buildReq(VALID_BODY) as never, ctx as never);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.response_id).toBe("resp-1");
      expect(body.pyth_price_at_response).toBe(100.5);
      // bankroll_usd should be 1000 - 100 = 900
      expect(body.bankroll_usd).toBe(900);
      expect(mockState.insertCalls).toBe(1);
      // agents.update called once (debit + last_seen_at together)
      expect(mockState.agentsUpdateCalls).toBe(1);
      expect(mockState.lastAgentsUpdatePayload?.bankroll_usd).toBe(900);
    });

    it("accepts optional source_url", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({ ...VALID_BODY, source_url: "https://example.com/signal" }) as never,
        ctx as never,
      );
      expect(res.status).toBe(201);
    });

    it("accepts optional reasoning", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({ ...VALID_BODY, reasoning: "momentum positive" }) as never,
        ctx as never,
      );
      expect(res.status).toBe(201);
    });
  });

  describe("bankroll", () => {
    it("returns 409 insufficient_bankroll when bankroll < position_size_usd", async () => {
      mockState.agentRow = { id: "agent-uuid-1", bankroll_usd: 50 };
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({ answer: "buy", confidence: 0.8, position_size_usd: 100 }) as never,
        ctx as never,
      );
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.code).toBe("insufficient_bankroll");
      expect(body.bankroll_usd).toBe(50);
      // No insert, no bankroll update
      expect(mockState.insertCalls).toBe(0);
      expect(mockState.agentsUpdateCalls).toBe(0);
    });

    it("allows exactly bankroll == position_size_usd (boundary — all-in)", async () => {
      mockState.agentRow = { id: "agent-uuid-1", bankroll_usd: 100 };
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({ answer: "sell", confidence: 0.5, position_size_usd: 100 }) as never,
        ctx as never,
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.bankroll_usd).toBe(0);
    });
  });

  describe("validation", () => {
    it("returns 422 when position_size_usd is missing", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({ answer: "buy", confidence: 0.7 }) as never,
        ctx as never,
      );
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.code).toBe("validation_failed");
      expect(mockState.insertCalls).toBe(0);
    });

    it("returns 422 when position_size_usd is below minimum (10)", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({ answer: "buy", confidence: 0.7, position_size_usd: 5 }) as never,
        ctx as never,
      );
      expect(res.status).toBe(422);
    });

    it("returns 422 when position_size_usd exceeds maximum (1000)", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({ answer: "buy", confidence: 0.7, position_size_usd: 1001 }) as never,
        ctx as never,
      );
      expect(res.status).toBe(422);
    });

    it("returns 422 when position_size_usd is not an integer", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({ answer: "buy", confidence: 0.7, position_size_usd: 50.5 }) as never,
        ctx as never,
      );
      expect(res.status).toBe(422);
    });

    it("returns 422 for invalid source_url", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({ ...VALID_BODY, source_url: "not-a-url" }) as never,
        ctx as never,
      );
      expect(res.status).toBe(422);
    });
  });

  describe("idempotency", () => {
    it("returns 409 already_responded on DB unique constraint violation", async () => {
      const { POST } = await import("./route");
      mockState.insertResult = () => ({
        data: null,
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      });
      const res = await POST(buildReq(VALID_BODY) as never, ctx as never);
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe("already_responded");
      // Bankroll update must NOT run on the duplicate path
      expect(mockState.agentsUpdateCalls).toBe(0);
    });

    it("sequential: first succeeds, second returns 409 already_responded", async () => {
      const { POST } = await import("./route");
      let call = 0;
      mockState.insertResult = () => {
        call++;
        if (call === 1) {
          return { data: { id: "resp-1", responded_at: new Date().toISOString() }, error: null };
        }
        return { data: null, error: { code: "23505", message: "duplicate key value" } };
      };

      const res1 = await POST(buildReq(VALID_BODY) as never, ctx as never);
      expect(res1.status).toBe(201);
      expect(mockState.agentsUpdateCalls).toBe(1);

      const res2 = await POST(buildReq(VALID_BODY) as never, ctx as never);
      expect(res2.status).toBe(409);
      expect(mockState.insertCalls).toBe(2);
      // Still only one bankroll debit
      expect(mockState.agentsUpdateCalls).toBe(1);
    });
  });

  describe("guard conditions", () => {
    it("returns 410 deadline_passed when query is past its deadline", async () => {
      const { POST } = await import("./route");
      mockState.queryRow = {
        ...mockState.queryRow,
        deadline_at: new Date(Date.now() - 1000).toISOString(),
      };
      const res = await POST(buildReq(VALID_BODY) as never, ctx as never);
      expect(res.status).toBe(410);
      expect(mockState.insertCalls).toBe(0);
      expect(mockState.agentsUpdateCalls).toBe(0);
    });

    it("returns 401 invalid_key when bearer token doesn't match any agent", async () => {
      const { POST } = await import("./route");
      mockState.agentRow = null;
      const res = await POST(buildReq(VALID_BODY) as never, ctx as never);
      expect(res.status).toBe(401);
      expect(mockState.insertCalls).toBe(0);
      expect(mockState.agentsUpdateCalls).toBe(0);
    });

    it("returns 401 missing_auth when no authorization header", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        buildReq(VALID_BODY, { authorization: "" }) as never,
        ctx as never,
      );
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.code).toBe("missing_auth");
    });
  });
});
