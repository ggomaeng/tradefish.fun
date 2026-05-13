/**
 * Tests for POST /api/agents/me/revive.
 *
 * Covers:
 *  1. 200 happy: agent with bankroll=$5 → bankroll=$1000, revival_count incremented
 *  2. 409 not_bust_yet: agent with bankroll=$200 → no change
 *  3. 401 unauthorized: missing Bearer
 *  4. 404 agent_not_found: valid Bearer key not matching any agent
 *  5. Concurrent revive race: only one update lands (BANKROLL_REVIVE_THRESHOLD_USD guard in UPDATE)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockState = {
  agentRow: { id: string; bankroll_usd: number; revival_count: number } | null;
  updateResult: () => { data: any; error: any };
  updateCalls: number;
  lastUpdatePayload: Record<string, unknown> | null;
};

const mockState: MockState = {
  agentRow: null,
  updateResult: () => ({
    data: { bankroll_usd: 1000, revival_count: 1 },
    error: null,
  }),
  updateCalls: 0,
  lastUpdatePayload: null,
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
            mockState.updateCalls++;
            mockState.lastUpdatePayload = payload;
            return {
              eq: (_col: string, _val: unknown) => ({
                lt: (_col2: string, _val2: unknown) => ({
                  select: (_cols: string) => ({
                    single: async () => mockState.updateResult(),
                  }),
                }),
              }),
            };
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  }),
}));

import { sha256 } from "@/lib/apikey";

const API_KEY = "tf_test_key_for_revive";
const API_KEY_HASH = sha256(API_KEY);

function buildReq(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/agents/me/revive", {
    method: "POST",
    headers: {
      authorization: `Bearer ${API_KEY}`,
      ...headers,
    },
  });
}

beforeEach(() => {
  mockState.agentRow = { id: "agent-uuid-1", bankroll_usd: 5, revival_count: 0 };
  mockState.updateCalls = 0;
  mockState.lastUpdatePayload = null;
  mockState.updateResult = () => ({
    data: { bankroll_usd: 1000, revival_count: 1 },
    error: null,
  });
  void API_KEY_HASH;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/agents/me/revive", () => {
  describe("happy path", () => {
    it("returns 200 with bankroll_usd=1000 and incremented revival_count when bankroll < threshold", async () => {
      const { POST } = await import("./route");
      const res = await POST(buildReq() as never);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.bankroll_usd).toBe(1000);
      expect(body.revival_count).toBe(1);
      expect(mockState.updateCalls).toBe(1);
      // The update payload should set bankroll_usd to DEFAULT_BANKROLL_USD (1000)
      expect(mockState.lastUpdatePayload?.bankroll_usd).toBe(1000);
    });

    it("increments revival_count from existing value", async () => {
      mockState.agentRow = { id: "agent-uuid-1", bankroll_usd: 0, revival_count: 3 };
      mockState.updateResult = () => ({
        data: { bankroll_usd: 1000, revival_count: 4 },
        error: null,
      });
      const { POST } = await import("./route");
      const res = await POST(buildReq() as never);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.revival_count).toBe(4);
      // Payload should have sent revival_count = 3 + 1
      expect(mockState.lastUpdatePayload?.revival_count).toBe(4);
    });
  });

  describe("not_bust_yet", () => {
    it("returns 409 not_bust_yet when bankroll >= threshold (exactly $200)", async () => {
      mockState.agentRow = { id: "agent-uuid-1", bankroll_usd: 200, revival_count: 0 };
      const { POST } = await import("./route");
      const res = await POST(buildReq() as never);
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.code).toBe("not_bust_yet");
      expect(body.bankroll_usd).toBe(200);
      // No update should fire
      expect(mockState.updateCalls).toBe(0);
    });

    it("revives when bankroll is below threshold (e.g. $50)", async () => {
      mockState.agentRow = { id: "agent-uuid-1", bankroll_usd: 50, revival_count: 0 };
      const { POST } = await import("./route");
      const res = await POST(buildReq() as never);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.bankroll_usd).toBe(1000);
      expect(mockState.updateCalls).toBe(1);
    });

    it("returns 409 not_bust_yet when bankroll is $1000 (fresh agent)", async () => {
      mockState.agentRow = { id: "agent-uuid-1", bankroll_usd: 1000, revival_count: 0 };
      const { POST } = await import("./route");
      const res = await POST(buildReq() as never);
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.code).toBe("not_bust_yet");
      expect(mockState.updateCalls).toBe(0);
    });
  });

  describe("auth errors", () => {
    it("returns 401 missing_auth when no authorization header", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        buildReq({ authorization: "" }) as never,
      );
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.code).toBe("missing_auth");
      expect(mockState.updateCalls).toBe(0);
    });

    it("returns 404 agent_not_found when Bearer key doesn't match any agent", async () => {
      mockState.agentRow = null;
      const { POST } = await import("./route");
      const res = await POST(buildReq() as never);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.code).toBe("agent_not_found");
      expect(mockState.updateCalls).toBe(0);
    });
  });

  describe("concurrent revive race", () => {
    it("returns 409 not_bust_yet when the DB update finds no row (race won by another revive)", async () => {
      // Agent appears bust at SELECT time, but by UPDATE time another revive has already fired.
      // The .lt("bankroll_usd", 10) guard means update returns no row → single() returns null/error.
      mockState.agentRow = { id: "agent-uuid-1", bankroll_usd: 5, revival_count: 0 };
      mockState.updateResult = () => ({
        data: null,
        error: { code: "PGRST116", message: "The result contains 0 rows" },
      });
      const { POST } = await import("./route");
      const res = await POST(buildReq() as never);
      // Route treats a failed single() as a race and returns 409 not_bust_yet
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.code).toBe("not_bust_yet");
      // The update was attempted (one call), but returned nothing
      expect(mockState.updateCalls).toBe(1);
    });
  });
});
