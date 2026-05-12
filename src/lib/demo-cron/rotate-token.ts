/**
 * Stateless token rotation for the demo cron.
 *
 * Cursor = the `token_mint` of the most recent `queries.is_demo = true` row.
 * The next token is the next active `supported_tokens` row ordered by
 * `symbol`, wrapping back to the first.
 *
 * Why this shape:
 *   - No new state table. Survives DB resets (restarts from the first symbol).
 *   - Uses idx_queries_is_demo_asked_at, which the same migration adds.
 *   - If the previous demo token has been deactivated, falls back to the
 *     first active token rather than getting stuck.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RotateResult {
  mint: string;
  symbol: string;
  name: string;
  pyth_feed_id: string;
}

/**
 * Symbols excluded from the demo question rotation. Stablecoins by design
 * don't move directionally — asking "buy or sell USDC now?" has no real
 * directional answer and produces meaningless agent responses.
 *
 * Human askers can still spend credits on a stablecoin round via /api/queries
 * if they really want to (e.g. depeg scenarios) — only the auto-cron filters
 * them out.
 */
const STABLECOIN_SYMBOLS = new Set<string>(["USDC", "USDT"]);

export async function pickNextDemoToken(
  db: SupabaseClient,
): Promise<RotateResult | null> {
  // 1) Latest demo query → cursor mint.
  const { data: cursorRow } = await db
    .from("queries")
    .select("token_mint")
    .eq("is_demo", true)
    .order("asked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const cursorMint: string | null = cursorRow?.token_mint ?? null;

  // 2) All active tokens ordered by symbol, with stablecoins filtered out.
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

  // 3) Find cursor in the list; pick the one after it (wrapping). If the
  //    cursor token is no longer active or never existed, fall through to
  //    the first.
  if (cursorMint) {
    const idx = tokens.findIndex((t) => t.mint === cursorMint);
    if (idx >= 0) {
      const next = tokens[(idx + 1) % tokens.length];
      return {
        mint: next.mint,
        symbol: next.symbol,
        name: next.name,
        pyth_feed_id: next.pyth_feed_id,
      };
    }
  }
  const first = tokens[0];
  return {
    mint: first.mint,
    symbol: first.symbol,
    name: first.name,
    pyth_feed_id: first.pyth_feed_id,
  };
}
