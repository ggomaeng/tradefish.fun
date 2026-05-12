/**
 * Volatility-weighted token rotation for the demo cron.
 *
 * The earlier version walked tokens alphabetically — fine for testing but
 * over-represented low-vol majors (SOL, JUP) on the demo board. With 5-min
 * rounds those tokens barely move; PnL stays near zero and agent rankings
 * don't differentiate. This version picks the next token via WEIGHTED
 * RANDOM SAMPLING biased toward volatile assets (BONK, WIF, JTO) so the
 * leaderboard sees actual PnL swings.
 *
 * Cursor = the most recent demo token. We exclude it from the next pool to
 * avoid immediate repeats, then sample by weight from the remainder. If
 * exclusion would empty the pool (e.g. only one active token), the cursor
 * is allowed back in.
 *
 * Properties:
 *   - Stateless (no new tables; cursor derived from queries table).
 *   - Volatile tokens average ~3× the airtime of majors.
 *   - Stablecoins (USDC/USDT) always excluded — no directional answer.
 *   - Unknown symbols fall back to weight 1 so adding a new token "just
 *     works" without changing this file.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RotateResult {
  mint: string;
  symbol: string;
  name: string;
  pyth_feed_id: string;
}

const STABLECOIN_SYMBOLS = new Set<string>(["USDC", "USDT"]);

/**
 * Empirical 5-min volatility weights for the demo rotation. Higher number
 * = more rotation airtime. Tuned for hackathon demo so meme tokens (which
 * have real PnL swings over a 5-min window) get more reps than majors.
 */
const TOKEN_VOLATILITY_WEIGHT: Record<string, number> = {
  BONK: 3,
  WIF: 3,
  JTO: 2,
  PYTH: 2,
  SOL: 1,
  JUP: 1,
};
const DEFAULT_WEIGHT = 1;

function weightFor(symbol: string | null | undefined): number {
  if (!symbol) return DEFAULT_WEIGHT;
  return TOKEN_VOLATILITY_WEIGHT[symbol.toUpperCase()] ?? DEFAULT_WEIGHT;
}

function pickWeighted<T>(items: T[], weight: (item: T) => number): T {
  const total = items.reduce((acc, t) => acc + weight(t), 0);
  if (total <= 0) return items[0];
  let r = Math.random() * total;
  for (const item of items) {
    r -= weight(item);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

export async function pickNextDemoToken(
  db: SupabaseClient,
): Promise<RotateResult | null> {
  // 1) Latest demo query → cursor mint (to exclude from next pick).
  const { data: cursorRow } = await db
    .from("queries")
    .select("token_mint")
    .eq("is_demo", true)
    .order("asked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const cursorMint: string | null = cursorRow?.token_mint ?? null;

  // 2) All active non-stablecoin tokens.
  const { data: rawTokens, error } = await db
    .from("supported_tokens")
    .select("mint, symbol, name, pyth_feed_id, active")
    .eq("active", true)
    .order("symbol", { ascending: true });

  if (error || !rawTokens || rawTokens.length === 0) return null;

  const tokens = rawTokens.filter(
    (t) => !STABLECOIN_SYMBOLS.has((t.symbol || "").toUpperCase()),
  );
  if (tokens.length === 0) return null;

  // 3) Exclude the cursor token to avoid immediate repeats — unless that
  //    would leave the pool empty (only one active token).
  const pool =
    cursorMint && tokens.length > 1
      ? tokens.filter((t) => t.mint !== cursorMint)
      : tokens;

  // 4) Weighted-random pick from the pool.
  const chosen = pickWeighted(pool, (t) => weightFor(t.symbol));
  return {
    mint: chosen.mint,
    symbol: chosen.symbol,
    name: chosen.name,
    pyth_feed_id: chosen.pyth_feed_id,
  };
}
