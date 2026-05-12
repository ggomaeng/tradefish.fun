import { describe, expect, it } from "vitest";
import {
  computePnl,
  LEVERAGE,
  SETTLE_GRACE_MS,
  DEFAULT_BANKROLL_USD,
  POSITION_SIZE_MIN_USD,
  POSITION_SIZE_MAX_USD,
  type Direction,
} from "./settlement";

/**
 * Settlement test suite — v1 model.
 *
 * Key invariants:
 *   computePnl("buy")  = positionSizeUsd * ((exit-entry)/entry) * LEVERAGE
 *   computePnl("sell") = positionSizeUsd * ((exit-entry)/entry) * -1 * LEVERAGE
 *   computePnl("hold") = 0  (always)
 */

const ENTRY = 100;

function pnl(
  direction: Direction,
  entryPrice: number,
  exitPrice: number,
  positionSizeUsd = 100,
): number {
  return computePnl({ direction, entryPrice, exitPrice, positionSizeUsd });
}

describe("Group A — constants", () => {
  it("LEVERAGE is 10", () => expect(LEVERAGE).toBe(10));
  it("SETTLE_GRACE_MS is 30 seconds", () => expect(SETTLE_GRACE_MS).toBe(30_000));
  it("DEFAULT_BANKROLL_USD is 1000", () => expect(DEFAULT_BANKROLL_USD).toBe(1000));
  it("POSITION_SIZE_MIN_USD is 10", () => expect(POSITION_SIZE_MIN_USD).toBe(10));
  it("POSITION_SIZE_MAX_USD is 1000", () => expect(POSITION_SIZE_MAX_USD).toBe(1000));
});

describe("Group B — buy direction", () => {
  it("buy + price up → positive PnL", () => {
    expect(pnl("buy", ENTRY, 110)).toBeGreaterThan(0);
  });

  it("buy + price down → negative PnL", () => {
    expect(pnl("buy", ENTRY, 90)).toBeLessThan(0);
  });

  it("buy + 10% up with $100 position at 10x → $100 PnL", () => {
    // sizeUsd * (exitChange/entry) * 1 * LEVERAGE = 100 * 0.10 * 10 = 100
    expect(pnl("buy", ENTRY, 110, 100)).toBeCloseTo(100, 6);
  });

  it("buy + 5% up with $200 position → $100 PnL", () => {
    // 200 * 0.05 * 10 = 100
    expect(pnl("buy", ENTRY, 105, 200)).toBeCloseTo(100, 6);
  });

  it("buy + price unchanged → zero PnL", () => {
    expect(pnl("buy", ENTRY, ENTRY)).toBeCloseTo(0, 9);
  });
});

describe("Group C — sell direction", () => {
  it("sell + price down → positive PnL", () => {
    expect(pnl("sell", ENTRY, 90)).toBeGreaterThan(0);
  });

  it("sell + price up → negative PnL", () => {
    expect(pnl("sell", ENTRY, 110)).toBeLessThan(0);
  });

  it("sell + 10% down with $100 position at 10x → $100 PnL", () => {
    // sizeUsd * ((90-100)/100) * -1 * 10 = 100 * -0.10 * -1 * 10 = 100
    expect(pnl("sell", ENTRY, 90, 100)).toBeCloseTo(100, 6);
  });

  it("sell + price unchanged → zero PnL", () => {
    expect(pnl("sell", ENTRY, ENTRY)).toBeCloseTo(0, 9);
  });

  it("buy and sell are mirror images for the same price move", () => {
    const buyPnl = pnl("buy", ENTRY, 115);
    const sellPnl = pnl("sell", ENTRY, 115);
    expect(buyPnl).toBeCloseTo(-sellPnl, 6);
  });
});

describe("Group D — hold direction", () => {
  it("hold always returns 0 regardless of price move", () => {
    expect(pnl("hold", ENTRY, 200)).toBe(0);
    expect(pnl("hold", ENTRY, 50)).toBe(0);
    expect(pnl("hold", ENTRY, ENTRY)).toBe(0);
    expect(pnl("hold", 0.001, 9999)).toBe(0);
  });
});

describe("Group E — position size scaling", () => {
  it("PnL scales linearly with position size", () => {
    const small = pnl("buy", ENTRY, 110, 10);
    const large = pnl("buy", ENTRY, 110, 100);
    expect(large).toBeCloseTo(small * 10, 6);
  });

  it("minimum position size $10 produces finite PnL", () => {
    const result = pnl("buy", ENTRY, 110, POSITION_SIZE_MIN_USD);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
  });

  it("maximum position size $1000 produces finite PnL", () => {
    const result = pnl("buy", ENTRY, 110, POSITION_SIZE_MAX_USD);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
  });
});

describe("Group F — leverage verification", () => {
  it("PnL magnitude equals positionSize × pricePct × LEVERAGE for buy", () => {
    // 1% move on $100 position at 10× → $10 PnL
    expect(pnl("buy", ENTRY, 101, 100)).toBeCloseTo(10, 4);
  });

  it("PnL magnitude equals positionSize × pricePct × LEVERAGE for sell", () => {
    // 1% down on $100 position short at 10× → $10 PnL
    expect(pnl("sell", ENTRY, 99, 100)).toBeCloseTo(10, 4);
  });

  it("large leveraged loss: 10% down on $1000 buy position → -$1000 PnL", () => {
    expect(pnl("buy", ENTRY, 90, 1000)).toBeCloseTo(-1000, 4);
  });
});

describe("Group G — edge cases", () => {
  it("very small price difference produces near-zero PnL", () => {
    expect(Math.abs(pnl("buy", ENTRY, 100.000001))).toBeLessThan(0.01);
  });

  it("large price move produces correct arithmetic", () => {
    // entry=1, exit=2 (100% gain) on $100 position short at 10× → -$1000 PnL
    expect(pnl("sell", 1, 2, 100)).toBeCloseTo(-1000, 4);
  });

  it("computePnl returns a number for all valid directions", () => {
    for (const dir of ["buy", "sell", "hold"] as Direction[]) {
      expect(typeof pnl(dir, 100, 110)).toBe("number");
    }
  });
});
