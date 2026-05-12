/**
 * Tests for POST /api/queries/[id]/comment.
 *
 * Covers:
 *  1. Prose-only comment (no direction) → 201 { comment_id }, no bankroll change.
 *  2. Trade-entry comment (direction + confidence + position_size_usd) →
 *     201 { comment_id, entry_price, bankroll_usd } with bankroll decremented.
 *  3. Insufficient bankroll on trade entry → 409 insufficient_bankroll.
 *  4. direction supplied without confidence → 422 validation_failed.
 *  5. direction supplied without position_size_usd → 422 validation_failed.
 *  6. No prior response on this query → 409 trade_required_before_comment.
 *  7. Comment window closed → 410 comment_window_closed.
 *  8. Invalid API key → 401 invalid_key.
 *  9. Missing body field → 422 validation_failed.
 * 10. No comment cap — can post multiple comments.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/clients/pyth", () => ({
  getPythPrice: vi.fn(async () => 42.0),
}));

type MockState = {
  agentRow: { id: string; short_id: string; bankroll_usd: number } | null;
  queryRow: any | null;
  priorTradeRow: { id: string } | null;
  insertResult: () => { data: any; error: any };
  agentsUpdateCalls: number;
  lastAgentsUpdatePayload: Record<string, unknown> | null;
};

const mockState: MockState = {
  agentRow: null,
  queryRow: null,
  priorTradeRow: null,
  insertResult: () => ({
    data: { id: "cmt-1", body: "test comment", created_at: new Date().toISOString() },
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
          update: (payload: Record<string, unknown>) => {
            // Track every update call regardless of chaining style.
            mockState.agentsUpdateCalls++;
            mockState.lastAgentsUpdatePayload = payload;
            return {
              eq: (_col: string, _val: unknown) => ({
                select: (_cols: string) => ({
                  single: async () => ({
                    data: { bankroll_usd: payload.bankroll_usd },
                    error: null,
                  }),
                }),
                // prose-only path just awaits the eq() result directly
                then: (resolve: (v: unknown) => void) =>
                  resolve({ data: null, error: null }),
              }),
            };
          },
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
          select: (_cols: string) => ({
            eq: (_col: string, _val: unknown) => ({
              eq: (_col2: string, _val2: unknown) => ({
                maybeSingle: async () => ({ data: mockState.priorTradeRow, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "comments") {
        return {
          insert: (_row: any) => ({
            select: (_cols: string) => ({
              single: async () => mockState.insertResult(),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  }),
}));

import { sha256 } from "@/lib/apikey";

const API_KEY = "tf_test_key_for_comment";
const API_KEY_HASH = sha256(API_KEY);

function buildReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/queries/qry_test01/comment", {
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
  mockState.agentRow = { id: "agent-uuid-1", short_id: "ag_test01", bankroll_usd: 1000 };
  mockState.queryRow = {
    id: "query-uuid-1",
    short_id: "qry_test01",
    // deadline 5 min in the future — comment window is deadline + 4 min, well open
    deadline_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    token_mint: "So11111111111111111111111111111111111111112",
    supported_tokens: { pyth_feed_id: "0xabc" },
  };
  mockState.priorTradeRow = { id: "resp-uuid-1" };
  mockState.agentsUpdateCalls = 0;
  mockState.lastAgentsUpdatePayload = null;
  mockState.insertResult = () => ({
    data: { id: "cmt-1", body: "test comment", created_at: new Date().toISOString() },
    error: null,
  });
  void API_KEY_HASH;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/queries/[id]/comment", () => {
  describe("prose-only comment", () => {
    it("returns 201 with only comment_id — no bankroll change", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({ body: "Interesting momentum signal here." }) as never,
        ctx as never,
      );
      expect(res.status).toBe(201);
      const resBody = await res.json();
      expect(resBody.comment_id).toBe("cmt-1");
      expect(resBody.entry_price).toBeUndefined();
      expect(resBody.bankroll_usd).toBeUndefined();
      // last_seen_at update fires but NO bankroll debit (agentsUpdateCalls = 1 for liveness only)
      expect(mockState.agentsUpdateCalls).toBe(1);
      expect(mockState.lastAgentsUpdatePayload?.bankroll_usd).toBeUndefined();
    });
  });

  describe("trade-entry comment", () => {
    it("returns 201 with comment_id, entry_price, and decremented bankroll_usd", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({
          body: "Going long — oracle aligned.",
          direction: "buy",
          confidence: 0.8,
          position_size_usd: 200,
        }) as never,
        ctx as never,
      );
      expect(res.status).toBe(201);
      const resBody = await res.json();
      expect(resBody.comment_id).toBe("cmt-1");
      expect(resBody.entry_price).toBe(42.0);
      // 1000 - 200 = 800
      expect(resBody.bankroll_usd).toBe(800);
      expect(mockState.agentsUpdateCalls).toBe(1);
      expect(mockState.lastAgentsUpdatePayload?.bankroll_usd).toBe(800);
    });

    it("allows hold direction (no PnL but still debits bankroll)", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({
          body: "Staying flat.",
          direction: "hold",
          confidence: 0.5,
          position_size_usd: 50,
        }) as never,
        ctx as never,
      );
      expect(res.status).toBe(201);
      const resBody = await res.json();
      expect(resBody.bankroll_usd).toBe(950);
    });
  });

  describe("bankroll enforcement", () => {
    it("returns 409 insufficient_bankroll when bankroll < position_size_usd", async () => {
      mockState.agentRow = { id: "agent-uuid-1", short_id: "ag_test01", bankroll_usd: 30 };
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({
          body: "Going long.",
          direction: "buy",
          confidence: 0.9,
          position_size_usd: 100,
        }) as never,
        ctx as never,
      );
      expect(res.status).toBe(409);
      const resBody = await res.json();
      expect(resBody.code).toBe("insufficient_bankroll");
      expect(resBody.bankroll_usd).toBe(30);
      expect(mockState.agentsUpdateCalls).toBe(0);
    });

    it("prose-only comment ignores bankroll (even with zero bankroll)", async () => {
      mockState.agentRow = { id: "agent-uuid-1", short_id: "ag_test01", bankroll_usd: 0 };
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({ body: "Just commentary." }) as never,
        ctx as never,
      );
      expect(res.status).toBe(201);
    });
  });

  describe("validation — all-or-nothing trade fields", () => {
    it("returns 422 when direction is set but confidence is missing", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({
          body: "Going long.",
          direction: "buy",
          position_size_usd: 100,
          // confidence missing
        }) as never,
        ctx as never,
      );
      expect(res.status).toBe(422);
      const resBody = await res.json();
      expect(resBody.code).toBe("validation_failed");
    });

    it("returns 422 when direction is set but position_size_usd is missing", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({
          body: "Going long.",
          direction: "buy",
          confidence: 0.8,
          // position_size_usd missing
        }) as never,
        ctx as never,
      );
      expect(res.status).toBe(422);
    });

    it("returns 422 when body is missing entirely", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({ direction: "buy", confidence: 0.8, position_size_usd: 100 }) as never,
        ctx as never,
      );
      expect(res.status).toBe(422);
    });

    it("returns 422 when position_size_usd is below minimum", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({
          body: "Trade.",
          direction: "buy",
          confidence: 0.7,
          position_size_usd: 5,
        }) as never,
        ctx as never,
      );
      expect(res.status).toBe(422);
    });
  });

  describe("no comment cap", () => {
    it("allows multiple comments without hitting a cap", async () => {
      const { POST } = await import("./route");
      // Post 5 prose-only comments — should all succeed
      for (let i = 0; i < 5; i++) {
        const res = await POST(
          buildReq({ body: `Comment number ${i + 1}.` }) as never,
          ctx as never,
        );
        expect(res.status).toBe(201);
      }
    });
  });

  describe("guard conditions", () => {
    it("returns 409 trade_required_before_comment when no prior response", async () => {
      mockState.priorTradeRow = null;
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({ body: "Trying to comment without a trade." }) as never,
        ctx as never,
      );
      expect(res.status).toBe(409);
      const resBody = await res.json();
      expect(resBody.code).toBe("trade_required_before_comment");
    });

    it("returns 410 comment_window_closed when past deadline + 4 min", async () => {
      mockState.queryRow = {
        ...mockState.queryRow,
        // deadline was 5 minutes ago → outside the 4-min comment window
        deadline_at: new Date(Date.now() - 5 * 60_000).toISOString(),
      };
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({ body: "Too late." }) as never,
        ctx as never,
      );
      expect(res.status).toBe(410);
      const resBody = await res.json();
      expect(resBody.code).toBe("comment_window_closed");
    });

    it("returns 404 query_not_found when query doesn't exist", async () => {
      mockState.queryRow = null;
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({ body: "Where did the query go?" }) as never,
        ctx as never,
      );
      expect(res.status).toBe(404);
    });

    it("returns 401 invalid_key when bearer token doesn't match any agent", async () => {
      mockState.agentRow = null;
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({ body: "Unauthorized." }) as never,
        ctx as never,
      );
      expect(res.status).toBe(401);
      const resBody = await res.json();
      expect(resBody.code).toBe("invalid_key");
    });

    it("returns 401 missing_auth when no authorization header", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({ body: "No auth." }, { authorization: "" }) as never,
        ctx as never,
      );
      expect(res.status).toBe(401);
      const resBody = await res.json();
      expect(resBody.code).toBe("missing_auth");
    });
  });
});
