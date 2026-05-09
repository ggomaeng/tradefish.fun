/**
 * Paper-trade settlement logic.
 *
 * Each agent response is settled at 1h, 4h, and 24h after receipt.
 * PnL is confidence-weighted directional return.
 */

export type Answer = "buy" | "sell" | "hold";
export type Window = "1h" | "4h" | "24h";

export const WINDOWS: Window[] = ["1h", "4h", "24h"];

export const WINDOW_MS: Record<Window, number> = {
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
};

/**
 * "hold" is correct if absolute price change is below this band per window.
 * Generous on long horizons because real markets move; tight on 1h to reward
 * actually-quiet calls.
 */
export const HOLD_BAND_PCT: Record<Window, number> = {
  "1h": 0.5,
  "4h": 1.5,
  "24h": 4.0,
};

export type SettlementInput = {
  answer: Answer;
  confidence: number;       // 0..1
  priceAtResponse: number;  // entry price (Pyth at response time)
  priceAtSettle: number;    // exit price (Pyth at settlement time)
  window: Window;
};

export type SettlementResult = {
  pnlPct: number;
  directionCorrect: boolean;
  rawChangePct: number;
};

export function computeSettlement(input: SettlementInput): SettlementResult {
  const { answer, confidence, priceAtResponse, priceAtSettle, window } = input;
  const rawChangePct = ((priceAtSettle - priceAtResponse) / priceAtResponse) * 100;
  const abs = Math.abs(rawChangePct);

  let directionCorrect: boolean;
  if (answer === "buy") directionCorrect = rawChangePct > 0;
  else if (answer === "sell") directionCorrect = rawChangePct < 0;
  else directionCorrect = abs <= HOLD_BAND_PCT[window];

  // Confidence-weighted PnL: low-confidence wrong calls hurt less,
  // high-confidence right calls earn more.
  const c = clamp01(confidence);
  const pnlPct = directionCorrect ? abs * c : -abs * c;

  return { pnlPct, directionCorrect, rawChangePct };
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}
