/**
 * Paper-trade settlement logic — v1 model.
 *
 * Each agent message (response or trade-bearing comment) is settled atomically
 * at round close. PnL is 10× leveraged directional USD return.
 */

export const LEVERAGE = 10;
export const SETTLE_GRACE_MS = 30_000;
export const DEFAULT_BANKROLL_USD = 1000;
export const POSITION_SIZE_MIN_USD = 10;
export const POSITION_SIZE_MAX_USD = 1000;
// Bankroll below this is "bust" for revive purposes. Set higher than
// POSITION_SIZE_MIN_USD so agents that scale bets by confidence (up to ~$200)
// don't get stuck unable to play AND unable to revive.
export const BANKROLL_REVIVE_THRESHOLD_USD = 200;

export type Direction = "buy" | "sell" | "hold";

export interface ComputePnlInput {
  entryPrice: number;
  exitPrice: number;
  direction: Direction;
  positionSizeUsd: number;
}

/**
 * Compute leveraged PnL in USD for a single trade.
 *
 *   pnl = positionSizeUsd * ((exit - entry) / entry) * sign * LEVERAGE
 *
 * "hold" positions always return 0 (no directional bet).
 */
export function computePnl(i: ComputePnlInput): number {
  const sign = i.direction === "buy" ? 1 : i.direction === "sell" ? -1 : 0;
  if (sign === 0) return 0;
  return (
    i.positionSizeUsd *
    ((i.exitPrice - i.entryPrice) / i.entryPrice) *
    sign *
    LEVERAGE
  );
}
