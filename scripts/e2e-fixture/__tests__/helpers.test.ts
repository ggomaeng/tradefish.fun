import { describe, it, expect } from "vitest";
import {
  parseArgs,
  checkBalanceSufficient,
  makeEmptySummary,
  loadFixtureKeypair,
  PER_RUN_TOPUP_LAMPORTS,
  MIN_FIXTURE_ASKER_BALANCE_LAMPORTS,
  HOUSE_AGENT_SHORT_ID,
  SOL_MINT,
} from "../index";

describe("e2e-fixture helpers", () => {
  describe("parseArgs", () => {
    it("extracts --target", () => {
      const r = parseArgs(["--target=https://example.com"]);
      expect(r.target).toBe("https://example.com");
      expect(r.dryRun).toBe(false);
    });

    it("strips trailing slashes from target", () => {
      const r = parseArgs(["--target=https://example.com/"]);
      expect(r.target).toBe("https://example.com");
    });

    it("flags --dry-run", () => {
      const r = parseArgs(["--target=https://example.com", "--dry-run"]);
      expect(r.dryRun).toBe(true);
    });

    it("falls back to E2E_FIXTURE_TARGET env when no flag", () => {
      const orig = process.env.E2E_FIXTURE_TARGET;
      process.env.E2E_FIXTURE_TARGET = "https://env.example.com";
      try {
        const r = parseArgs([]);
        expect(r.target).toBe("https://env.example.com");
      } finally {
        if (orig === undefined) delete process.env.E2E_FIXTURE_TARGET;
        else process.env.E2E_FIXTURE_TARGET = orig;
      }
    });

    it("returns null target when neither flag nor env set", () => {
      const orig = process.env.E2E_FIXTURE_TARGET;
      delete process.env.E2E_FIXTURE_TARGET;
      try {
        const r = parseArgs([]);
        expect(r.target).toBeNull();
      } finally {
        if (orig !== undefined) process.env.E2E_FIXTURE_TARGET = orig;
      }
    });
  });

  describe("checkBalanceSufficient", () => {
    it("ok when balance >= min", () => {
      const r = checkBalanceSufficient(MIN_FIXTURE_ASKER_BALANCE_LAMPORTS);
      expect(r.ok).toBe(true);
      expect(r.have).toBe(MIN_FIXTURE_ASKER_BALANCE_LAMPORTS);
      expect(r.needed).toBe(MIN_FIXTURE_ASKER_BALANCE_LAMPORTS);
    });

    it("not ok when balance < min", () => {
      const r = checkBalanceSufficient(0);
      expect(r.ok).toBe(false);
      expect(r.have).toBe(0);
    });

    it("respects custom min", () => {
      const r = checkBalanceSufficient(5, 10);
      expect(r.ok).toBe(false);
      expect(r.needed).toBe(10);
    });
  });

  describe("makeEmptySummary", () => {
    it("returns the canonical JSON shape", () => {
      const s = makeEmptySummary();
      expect(s).toMatchObject({
        outcome: "failed",
        query_id: null,
        ephemeral_agent_id: null,
        house_agent_responded: false,
        latency_ms: null,
        balances_before: { fixture_asker_lamports: null, treasury_lamports: null },
        balances_after: { fixture_asker_lamports: null, treasury_lamports: null },
      });
    });
  });

  describe("loadFixtureKeypair", () => {
    it("throws when path missing", () => {
      expect(() => loadFixtureKeypair("/nonexistent/path/missing.json")).toThrow(
        /not found/,
      );
    });
  });

  describe("constants", () => {
    it("topup is at least the API-route minimum (10_000_000 lamports)", () => {
      expect(PER_RUN_TOPUP_LAMPORTS).toBeGreaterThanOrEqual(10_000_000);
    });
    it("balance gate covers one full topup", () => {
      expect(MIN_FIXTURE_ASKER_BALANCE_LAMPORTS).toBeGreaterThanOrEqual(
        PER_RUN_TOPUP_LAMPORTS,
      );
    });
    it("house agent short id matches STATE.md (tick 21)", () => {
      expect(HOUSE_AGENT_SHORT_ID).toBe("ag_q1ujorfm");
    });
    it("SOL mint is the canonical wrapped SOL address", () => {
      expect(SOL_MINT).toBe("So11111111111111111111111111111111111111112");
    });
  });
});
