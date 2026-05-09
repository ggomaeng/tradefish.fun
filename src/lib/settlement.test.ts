import { describe, expect, it } from "vitest";
import {
  computeSettlement,
  HOLD_BAND_PCT,
  WINDOWS,
  type Window,
} from "./settlement";

/**
 * Settlement test suite.
 *
 * The actual function returns `{ pnlPct, directionCorrect, rawChangePct }`.
 * The task description used `raw_pnl`/`weighted_pnl` terminology — in this
 * implementation those map to `rawChangePct` (directionless % move) and
 * `pnlPct` (signed, confidence-weighted PnL). The "directional raw PnL"
 * (sign by directionCorrect, before confidence weighting) is reconstructible
 * as `directionCorrect ? abs(rawChangePct) : -abs(rawChangePct)`.
 *
 * Key invariants we test:
 *   pnlPct = (directionCorrect ? +1 : -1) * |rawChangePct| * clamp01(confidence)
 *   directionCorrect:
 *     buy  → rawChangePct >  0
 *     sell → rawChangePct <  0
 *     hold → |rawChangePct| <= HOLD_BAND_PCT[window]   (boundary INCLUSIVE)
 */

const PRICE_BASE = 100;

function priceFromPctChange(pct: number): number {
  return PRICE_BASE * (1 + pct / 100);
}

describe("Group A — direction correctness across windows", () => {
  for (const window of WINDOWS) {
    describe(`window=${window}`, () => {
      it("buy + price up → directionCorrect, positive pnlPct", () => {
        // Use a move clearly outside any hold band so this is unambiguous for
        // the buy/sell cases (moves are larger than HOLD_BAND_PCT['24h']=4).
        const r = computeSettlement({
          answer: "buy",
          confidence: 1,
          priceAtResponse: PRICE_BASE,
          priceAtSettle: priceFromPctChange(5),
          window,
        });
        expect(r.directionCorrect).toBe(true);
        expect(r.pnlPct).toBeGreaterThan(0);
        expect(r.rawChangePct).toBeCloseTo(5, 6);
      });

      it("buy + price down → wrong direction, negative pnlPct", () => {
        const r = computeSettlement({
          answer: "buy",
          confidence: 1,
          priceAtResponse: PRICE_BASE,
          priceAtSettle: priceFromPctChange(-5),
          window,
        });
        expect(r.directionCorrect).toBe(false);
        expect(r.pnlPct).toBeLessThan(0);
        expect(r.rawChangePct).toBeCloseTo(-5, 6);
      });

      it("sell + price up → wrong direction, negative pnlPct (correctly inverted)", () => {
        const r = computeSettlement({
          answer: "sell",
          confidence: 1,
          priceAtResponse: PRICE_BASE,
          priceAtSettle: priceFromPctChange(5),
          window,
        });
        expect(r.directionCorrect).toBe(false);
        expect(r.pnlPct).toBeLessThan(0);
      });

      it("sell + price down → directionCorrect, positive pnlPct", () => {
        const r = computeSettlement({
          answer: "sell",
          confidence: 1,
          priceAtResponse: PRICE_BASE,
          priceAtSettle: priceFromPctChange(-5),
          window,
        });
        expect(r.directionCorrect).toBe(true);
        expect(r.pnlPct).toBeGreaterThan(0);
      });
    });
  }
});

describe("Group B — hold band per window", () => {
  for (const window of WINDOWS) {
    const band = HOLD_BAND_PCT[window];

    describe(`window=${window} (hold_band=${band}%)`, () => {
      it("hold + move WITHIN band → correct, positive pnlPct", () => {
        const insideMove = band / 2; // strictly inside
        const r = computeSettlement({
          answer: "hold",
          confidence: 1,
          priceAtResponse: PRICE_BASE,
          priceAtSettle: priceFromPctChange(insideMove),
          window,
        });
        expect(r.directionCorrect).toBe(true);
        expect(r.pnlPct).toBeGreaterThan(0);
      });

      it("hold + move OUTSIDE band → wrong, negative pnlPct", () => {
        const outsideMove = band + 1; // clearly outside
        const r = computeSettlement({
          answer: "hold",
          confidence: 1,
          priceAtResponse: PRICE_BASE,
          priceAtSettle: priceFromPctChange(outsideMove),
          window,
        });
        expect(r.directionCorrect).toBe(false);
        expect(r.pnlPct).toBeLessThan(0);
      });

      it("hold + negative move WITHIN band → correct (band is symmetric)", () => {
        const r = computeSettlement({
          answer: "hold",
          confidence: 1,
          priceAtResponse: PRICE_BASE,
          priceAtSettle: priceFromPctChange(-band / 2),
          window,
        });
        expect(r.directionCorrect).toBe(true);
        expect(r.pnlPct).toBeGreaterThan(0);
      });

      it("hold + negative move OUTSIDE band → wrong", () => {
        const r = computeSettlement({
          answer: "hold",
          confidence: 1,
          priceAtResponse: PRICE_BASE,
          priceAtSettle: priceFromPctChange(-(band + 1)),
          window,
        });
        expect(r.directionCorrect).toBe(false);
        expect(r.pnlPct).toBeLessThan(0);
      });

      it("hold + move EXACTLY at band boundary → correct (boundary INCLUSIVE)", () => {
        // Spec ambiguity resolved by reading the source: settlement uses
        // `abs <= HOLD_BAND_PCT[window]`, so a move equal to the band is a
        // correct hold. Test pins this so any future flip to `<` is caught.
        // We construct priceAtSettle so rawChangePct === band exactly:
        const priceAtSettle = PRICE_BASE * (1 + band / 100);
        const r = computeSettlement({
          answer: "hold",
          confidence: 1,
          priceAtResponse: PRICE_BASE,
          priceAtSettle,
          window,
        });
        expect(r.rawChangePct).toBeCloseTo(band, 9);
        expect(r.directionCorrect).toBe(true);
        expect(r.pnlPct).toBeGreaterThan(0);
      });
    });
  }

  it("hold band differs per window (1h tightest, 24h loosest)", () => {
    expect(HOLD_BAND_PCT["1h"]).toBeLessThan(HOLD_BAND_PCT["4h"]);
    expect(HOLD_BAND_PCT["4h"]).toBeLessThan(HOLD_BAND_PCT["24h"]);
  });

  it("a 1% move is hold-correct on 4h/24h but wrong on 1h (band differs)", () => {
    // 1h band = 0.5, 4h band = 1.5, 24h band = 4.0.
    // 1% move is outside 1h's tight band but inside 4h and 24h bands.
    const inputBase = {
      answer: "hold" as const,
      confidence: 1,
      priceAtResponse: PRICE_BASE,
      priceAtSettle: priceFromPctChange(1),
    };
    expect(
      computeSettlement({ ...inputBase, window: "1h" }).directionCorrect,
    ).toBe(false);
    expect(
      computeSettlement({ ...inputBase, window: "4h" }).directionCorrect,
    ).toBe(true);
    expect(
      computeSettlement({ ...inputBase, window: "24h" }).directionCorrect,
    ).toBe(true);
  });

  it("a 3% move is hold-correct only on 24h (4h band exceeded)", () => {
    const inputBase = {
      answer: "hold" as const,
      confidence: 1,
      priceAtResponse: PRICE_BASE,
      priceAtSettle: priceFromPctChange(3),
    };
    expect(
      computeSettlement({ ...inputBase, window: "1h" }).directionCorrect,
    ).toBe(false);
    expect(
      computeSettlement({ ...inputBase, window: "4h" }).directionCorrect,
    ).toBe(false);
    expect(
      computeSettlement({ ...inputBase, window: "24h" }).directionCorrect,
    ).toBe(true);
  });
});

describe("Group C — confidence weighting", () => {
  const window: Window = "1h";
  const baseInput = {
    answer: "buy" as const,
    priceAtResponse: PRICE_BASE,
    priceAtSettle: priceFromPctChange(5), // +5% move, buy is correct
    window,
  };

  it("confidence=0 → weighted pnl ≈ 0 (correct direction still earns nothing)", () => {
    const r = computeSettlement({ ...baseInput, confidence: 0 });
    expect(r.directionCorrect).toBe(true);
    expect(r.pnlPct).toBeCloseTo(0, 9);
  });

  it("confidence=0.5 → weighted pnl ≈ rawAbs × 0.5", () => {
    const r = computeSettlement({ ...baseInput, confidence: 0.5 });
    expect(r.pnlPct).toBeCloseTo(5 * 0.5, 6);
  });

  it("confidence=1.0 → weighted pnl ≈ rawAbs (full credit)", () => {
    const r = computeSettlement({ ...baseInput, confidence: 1.0 });
    expect(r.pnlPct).toBeCloseTo(5, 6);
  });

  it("confidence linearly scales the magnitude of pnl for wrong calls too", () => {
    // wrong-direction call: sell on +5% move
    const wrongHalf = computeSettlement({
      ...baseInput,
      answer: "sell",
      confidence: 0.5,
    });
    const wrongFull = computeSettlement({
      ...baseInput,
      answer: "sell",
      confidence: 1.0,
    });
    expect(wrongHalf.pnlPct).toBeCloseTo(-5 * 0.5, 6);
    expect(wrongFull.pnlPct).toBeCloseTo(-5, 6);
  });

  it("confidence > 1 is clamped to 1 (documented behavior of clamp01)", () => {
    // Spec ambiguity resolved: settlement.ts clamps via clamp01 rather
    // than throwing. Pin behavior so future changes are intentional.
    const r = computeSettlement({ ...baseInput, confidence: 5 });
    expect(r.pnlPct).toBeCloseTo(5, 6); // same as confidence=1
  });

  it("confidence < 0 is clamped to 0 (no negative confidence)", () => {
    const r = computeSettlement({ ...baseInput, confidence: -2 });
    expect(r.pnlPct).toBeCloseTo(0, 9);
  });

  it("non-finite confidence (NaN) is treated as 0", () => {
    const r = computeSettlement({ ...baseInput, confidence: Number.NaN });
    expect(r.pnlPct).toBeCloseTo(0, 9);
  });
});

describe("Group D — edge cases", () => {
  it("zero price change: buy → directionCorrect=false, pnlPct ≈ 0", () => {
    // rawChangePct === 0; for buy, `0 > 0` is false → wrong direction.
    // pnl = -|0| * c = 0. Sign of zero shouldn't matter for the leaderboard.
    const r = computeSettlement({
      answer: "buy",
      confidence: 1,
      priceAtResponse: PRICE_BASE,
      priceAtSettle: PRICE_BASE,
      window: "1h",
    });
    expect(r.rawChangePct).toBe(0);
    expect(r.directionCorrect).toBe(false);
    expect(Math.abs(r.pnlPct)).toBeCloseTo(0, 9);
  });

  it("zero price change: sell → directionCorrect=false, pnlPct ≈ 0", () => {
    const r = computeSettlement({
      answer: "sell",
      confidence: 1,
      priceAtResponse: PRICE_BASE,
      priceAtSettle: PRICE_BASE,
      window: "1h",
    });
    expect(r.directionCorrect).toBe(false);
    expect(Math.abs(r.pnlPct)).toBeCloseTo(0, 9);
  });

  it("zero price change: hold → directionCorrect=true, pnlPct ≈ 0", () => {
    // 0 ≤ band so hold is correct, but |rawChangePct| = 0 → pnl is exactly 0.
    // Verifies a "perfect hold" earns no points but isn't penalised.
    const r = computeSettlement({
      answer: "hold",
      confidence: 1,
      priceAtResponse: PRICE_BASE,
      priceAtSettle: PRICE_BASE,
      window: "1h",
    });
    expect(r.directionCorrect).toBe(true);
    expect(r.pnlPct).toBeCloseTo(0, 9);
  });

  it("numerical precision: 5.000001% vs 5% boundary near 4h hold band", () => {
    // 4h hold band is 1.5%. Test that values just below / just above are
    // categorised correctly without floating-point flakiness.
    const just_below = computeSettlement({
      answer: "hold",
      confidence: 1,
      priceAtResponse: PRICE_BASE,
      priceAtSettle: priceFromPctChange(1.499999),
      window: "4h",
    });
    const just_above = computeSettlement({
      answer: "hold",
      confidence: 1,
      priceAtResponse: PRICE_BASE,
      priceAtSettle: priceFromPctChange(1.500001),
      window: "4h",
    });
    expect(just_below.directionCorrect).toBe(true);
    expect(just_above.directionCorrect).toBe(false);
    expect(just_below.rawChangePct).toBeCloseTo(1.499999, 6);
    expect(just_above.rawChangePct).toBeCloseTo(1.500001, 6);
  });

  it("rawChangePct sign mirrors raw price direction (sanity check formula)", () => {
    const up = computeSettlement({
      answer: "hold",
      confidence: 0.7,
      priceAtResponse: 200,
      priceAtSettle: 210,
      window: "24h",
    });
    expect(up.rawChangePct).toBeCloseTo(5, 6);

    const down = computeSettlement({
      answer: "hold",
      confidence: 0.7,
      priceAtResponse: 200,
      priceAtSettle: 190,
      window: "24h",
    });
    expect(down.rawChangePct).toBeCloseTo(-5, 6);
  });

  it("pnlPct is always confidence × |rawChangePct| in magnitude", () => {
    // Property check across a few sample inputs.
    const samples = [
      { answer: "buy" as const, priceAtSettle: 105, confidence: 0.3 },
      { answer: "sell" as const, priceAtSettle: 102, confidence: 0.8 },
      { answer: "hold" as const, priceAtSettle: 100.4, confidence: 0.6 },
      { answer: "buy" as const, priceAtSettle: 95, confidence: 1 },
    ];
    for (const s of samples) {
      const r = computeSettlement({
        answer: s.answer,
        confidence: s.confidence,
        priceAtResponse: 100,
        priceAtSettle: s.priceAtSettle,
        window: "1h",
      });
      expect(Math.abs(r.pnlPct)).toBeCloseTo(
        Math.abs(r.rawChangePct) * s.confidence,
        6,
      );
    }
  });
});
