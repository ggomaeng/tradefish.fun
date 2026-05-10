/**
 * Dispatch HMAC tests.
 *
 * Verifies:
 *  - When the agent has a (correctly encrypted) webhook secret, the outbound
 *    fetch carries `X-TradeFish-Signature: sha256=<hmac(secret, body)>`
 *    computed over the EXACT body bytes sent.
 *  - When the agent has NO encrypted secret (legacy row), the dispatch still
 *    fires but the signature header is omitted (and a warning is logged).
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
import { createHmac, randomBytes } from "node:crypto";

import { encryptWebhookSecret } from "@/lib/webhook-crypto";

// Hoisted state captured by the mocked Supabase client — module-load order
// matters because the route imports `dbAdmin` at the top.
type AgentRow = {
  id: string;
  endpoint: string | null;
  webhook_secret_encrypted: unknown;
};

const dbState: { agents: AgentRow[] } = { agents: [] };

vi.mock("@/lib/db", () => ({
  dbAdmin: () => ({
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: unknown) => ({
          not: async (_c: string, _o: string, _v: unknown) => ({
            data: dbState.agents,
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

const TEST_KEY_HEX = randomBytes(32).toString("hex");
const INTERNAL_SECRET = "test-internal-" + randomBytes(8).toString("hex");

let savedKey: string | undefined;
let savedInternal: string | undefined;
let fetchMock: ReturnType<typeof vi.fn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  savedKey = process.env.WEBHOOK_MASTER_KEY;
  savedInternal = process.env.INTERNAL_WEBHOOK_HMAC_SECRET;
  process.env.WEBHOOK_MASTER_KEY = TEST_KEY_HEX;
  process.env.INTERNAL_WEBHOOK_HMAC_SECRET = INTERNAL_SECRET;
});

afterAll(() => {
  if (savedKey === undefined) delete process.env.WEBHOOK_MASTER_KEY;
  else process.env.WEBHOOK_MASTER_KEY = savedKey;
  if (savedInternal === undefined) delete process.env.INTERNAL_WEBHOOK_HMAC_SECRET;
  else process.env.INTERNAL_WEBHOOK_HMAC_SECRET = savedInternal;
});

beforeEach(() => {
  dbState.agents = [];
  fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
  vi.stubGlobal("fetch", fetchMock);
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  warnSpy.mockRestore();
});

function buildRequest(body: object): Request {
  return new Request("http://localhost/api/internal/dispatch", {
    method: "POST",
    headers: {
      authorization: `Bearer ${INTERNAL_SECRET}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

const SAMPLE_QUERY = {
  query_id: "qry_test_001",
  mint: "So11111111111111111111111111111111111111112",
  symbol: "SOL",
  deadline_at: "2026-05-09T12:34:56.000Z",
};

const EXPECTED_PAYLOAD = JSON.stringify({
  query_id: SAMPLE_QUERY.query_id,
  token: { mint: SAMPLE_QUERY.mint, symbol: SAMPLE_QUERY.symbol },
  question: "buy_sell_now",
  deadline_at: SAMPLE_QUERY.deadline_at,
});

describe("POST /api/internal/dispatch — HMAC signing", () => {
  it("signs the payload with the agent's decrypted webhook secret", async () => {
    const secret = "whs_" + randomBytes(24).toString("hex");
    const blob = encryptWebhookSecret(secret);
    dbState.agents = [
      {
        id: "agent-uuid-1",
        endpoint: "https://agent.example.com/hook",
        // Simulate Supabase PostgREST bytea encoding.
        webhook_secret_encrypted: `\\x${blob.toString("hex")}`,
      },
    ];

    // Re-import the route fresh so the dbAdmin mock is bound.
    const { POST } = await import("./route");
    const res = await POST(buildRequest(SAMPLE_QUERY) as never);
    const body = await res.json();

    expect(body.dispatched).toBe(1);
    expect(body.failed).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://agent.example.com/hook");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(EXPECTED_PAYLOAD);

    const headers = init.headers as Record<string, string>;
    expect(headers["X-TradeFish-Event"]).toBe("query.created");
    expect(headers["Content-Type"]).toBe("application/json");

    const sig = headers["X-TradeFish-Signature"];
    expect(sig).toBeTruthy();
    expect(sig.startsWith("sha256=")).toBe(true);

    // Compute the expected signature independently and compare.
    const expectedHex = createHmac("sha256", secret)
      .update(EXPECTED_PAYLOAD)
      .digest("hex");
    expect(sig).toBe(`sha256=${expectedHex}`);
  });

  it("dispatches without a signature when the agent has no encrypted secret (legacy)", async () => {
    dbState.agents = [
      {
        id: "agent-uuid-legacy",
        endpoint: "https://legacy.example.com/hook",
        webhook_secret_encrypted: null,
      },
    ];

    const { POST } = await import("./route");
    const res = await POST(buildRequest(SAMPLE_QUERY) as never);
    const body = await res.json();

    expect(body.dispatched).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers["X-TradeFish-Signature"]).toBeUndefined();
    expect(headers["X-TradeFish-Event"]).toBe("query.created");
    // Body bytes still match the canonical payload.
    expect(init.body).toBe(EXPECTED_PAYLOAD);
    // We expect a warning about the legacy agent.
    expect(warnSpy).toHaveBeenCalled();
  });

  it("rejects requests without the internal bearer token", async () => {
    const req = new Request("http://localhost/api/internal/dispatch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(SAMPLE_QUERY),
    });
    const { POST } = await import("./route");
    const res = await POST(req as never);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("decodeBytea", () => {
  it("decodes the PostgREST `\\x...` hex form", async () => {
    const { decodeBytea } = await import("./route");
    const out = decodeBytea("\\xdeadbeef");
    expect(out).not.toBeNull();
    expect(out!.equals(Buffer.from([0xde, 0xad, 0xbe, 0xef]))).toBe(true);
  });

  it("passes Buffer through unchanged", async () => {
    const { decodeBytea } = await import("./route");
    const buf = Buffer.from([1, 2, 3, 4]);
    expect(decodeBytea(buf)).toBe(buf);
  });

  it("returns null for null/undefined", async () => {
    const { decodeBytea } = await import("./route");
    expect(decodeBytea(null)).toBeNull();
    expect(decodeBytea(undefined)).toBeNull();
  });
});
