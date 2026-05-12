/**
 * Unit tests for dedupOrPrepare.
 *
 * We mock @/lib/db so no real Supabase connection is required.
 * The match_wiki RPC is simulated by controlling the rows it returns.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ── mock @/lib/db BEFORE importing the module under test ──────────────────────
const mockRpc = vi.fn();
vi.mock("@/lib/db", () => ({
  dbAdmin: () => ({ rpc: mockRpc }),
}));

// Import after mocking
import { dedupOrPrepare, MERGE_THRESHOLD } from "../dedup";

// ── helpers ───────────────────────────────────────────────────────────────────
const DUMMY_EMBEDDING = new Array(1536).fill(0.01);

function mockMatchWiki(rows: Array<{ slug: string; similarity: number }>) {
  mockRpc.mockResolvedValueOnce({ data: rows, error: null });
}

// ── tests ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

describe("dedupOrPrepare — merge branch", () => {
  it("returns action=merge when top similarity exceeds threshold", async () => {
    mockMatchWiki([
      { slug: "existing-note", similarity: 0.95 },
      { slug: "another-note", similarity: 0.80 },
    ]);

    const result = await dedupOrPrepare(DUMMY_EMBEDDING);

    expect(result.action).toBe("merge");
    if (result.action === "merge") {
      expect(result.existing_slug).toBe("existing-note");
      expect(result.similarity).toBe(0.95);
    }
  });

  it("returns action=merge at exactly the boundary (> threshold, not >=)", async () => {
    // Boundary: 0.92 should NOT merge; 0.921 should
    mockMatchWiki([{ slug: "boundary-note", similarity: 0.921 }]);
    const above = await dedupOrPrepare(DUMMY_EMBEDDING);
    expect(above.action).toBe("merge");
  });

  it("does NOT merge when similarity equals threshold exactly", async () => {
    mockMatchWiki([{ slug: "exact-boundary", similarity: MERGE_THRESHOLD }]);
    const result = await dedupOrPrepare(DUMMY_EMBEDDING);
    expect(result.action).toBe("insert");
  });
});

describe("dedupOrPrepare — insert branch", () => {
  it("returns action=insert when no rows exceed threshold", async () => {
    mockMatchWiki([
      { slug: "neighbor-a", similarity: 0.80 },
      { slug: "neighbor-b", similarity: 0.70 },
      { slug: "neighbor-c", similarity: 0.60 },
    ]);

    const result = await dedupOrPrepare(DUMMY_EMBEDDING);

    expect(result.action).toBe("insert");
    if (result.action === "insert") {
      expect(result.neighbors).toHaveLength(3);
      expect(result.neighbors[0].slug).toBe("neighbor-a");
      expect(result.neighbors[0].similarity).toBe(0.80);
    }
  });

  it("returns action=insert with empty neighbors when db returns no rows", async () => {
    mockMatchWiki([]);

    const result = await dedupOrPrepare(DUMMY_EMBEDDING);

    expect(result.action).toBe("insert");
    if (result.action === "insert") {
      expect(result.neighbors).toHaveLength(0);
    }
  });

  it("filters out zero-similarity neighbors", async () => {
    mockMatchWiki([
      { slug: "good-neighbor", similarity: 0.50 },
      { slug: "zero-neighbor", similarity: 0.0 },
    ]);

    const result = await dedupOrPrepare(DUMMY_EMBEDDING);
    expect(result.action).toBe("insert");
    if (result.action === "insert") {
      expect(result.neighbors.some((n) => n.slug === "zero-neighbor")).toBe(false);
      expect(result.neighbors).toHaveLength(1);
    }
  });
});

describe("dedupOrPrepare — error handling", () => {
  it("throws when match_wiki RPC returns an error", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "rpc error" },
    });

    await expect(dedupOrPrepare(DUMMY_EMBEDDING)).rejects.toThrow("match_wiki RPC failed");
  });
});
