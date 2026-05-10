import { describe, expect, it } from "vitest";
import {
  SUPPORTED_TOKENS,
  getTokenByMint,
  getTokenBySymbol,
} from "./supported-tokens";

/**
 * Snapshot test of the canonical Pyth MAINNET feed ID for every supported token.
 *
 * Each entry was verified live against Hermes
 * (`GET https://hermes.pyth.network/v2/updates/price/latest?ids[]=<id>`).
 * This test is intentionally pure-data (no network) so that any future change
 * to the table requires an explicit update here — preventing silent swaps to
 * a wrong/devnet feed ID, which would cause silent settlement drift.
 *
 * If you need to add a new token: verify the feed ID against
 * https://pyth.network/developers/price-feed-ids (Solana Mainnet) AND query
 * Hermes locally before updating the snapshot below.
 *
 * RUNBOOK §2 confirmed-list tokens are marked.
 */
const CANONICAL_MAINNET_FEED_IDS: Record<string, string> = {
  // RUNBOOK §2 confirmed list
  SOL: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  BONK: "0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419",
  JUP: "0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996",
  WIF: "0x4ca4beeca86f0d164160323817a4e42b10010a724c2217c6ee41b54cd4cc61fc",
  PYTH: "0x0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff",
  JTO: "0xb43660a5f790c69354b0729a5ef9d50d68f1df92107540210b9cccba1f947cc2",
  // Extras (verified live; not in RUNBOOK §2 explicit list but shipped)
  USDC: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
  USDT: "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
};

describe("supported-tokens", () => {
  it("every token has a 0x-prefixed 32-byte hex Pyth feed ID", () => {
    for (const t of SUPPORTED_TOKENS) {
      expect(t.pythFeedId, `${t.symbol} pythFeedId shape`).toMatch(
        /^0x[0-9a-f]{64}$/,
      );
    }
  });

  it("each supported token uses the canonical MAINNET Pyth feed ID", () => {
    for (const t of SUPPORTED_TOKENS) {
      const expected = CANONICAL_MAINNET_FEED_IDS[t.symbol];
      expect(
        expected,
        `no canonical mainnet feed ID recorded for ${t.symbol} — update the snapshot in supported-tokens.test.ts`,
      ).toBeDefined();
      expect(t.pythFeedId, `${t.symbol} feed ID drift`).toBe(expected);
    }
  });

  it("RUNBOOK §2 confirmed mainnet tokens are all present", () => {
    const required = ["SOL", "BONK", "JUP", "WIF", "PYTH", "JTO"];
    const symbols = SUPPORTED_TOKENS.map((t) => t.symbol);
    for (const sym of required) {
      expect(symbols, `RUNBOOK §2 token ${sym} missing`).toContain(sym);
    }
  });

  it("symbols and mints are unique", () => {
    const symbols = SUPPORTED_TOKENS.map((t) => t.symbol);
    const mints = SUPPORTED_TOKENS.map((t) => t.mint);
    expect(new Set(symbols).size).toBe(symbols.length);
    expect(new Set(mints).size).toBe(mints.length);
  });

  it("feed IDs are unique across the table", () => {
    const ids = SUPPORTED_TOKENS.map((t) => t.pythFeedId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getTokenBySymbol is case-insensitive", () => {
    expect(getTokenBySymbol("sol")?.symbol).toBe("SOL");
    expect(getTokenBySymbol("SOL")?.symbol).toBe("SOL");
    expect(getTokenBySymbol("nope")).toBeUndefined();
  });

  it("getTokenByMint returns the matching token", () => {
    const sol = SUPPORTED_TOKENS.find((t) => t.symbol === "SOL")!;
    expect(getTokenByMint(sol.mint)?.symbol).toBe("SOL");
    expect(getTokenByMint("not-a-mint")).toBeUndefined();
  });
});
