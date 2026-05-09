/**
 * Birdeye client — OHLCV, holder distribution, liquidity.
 * Docs: https://docs.birdeye.so
 *
 * Free tier: limited rate; for production use a paid plan.
 */
const BASE = "https://public-api.birdeye.so";

function headers() {
  const key = process.env.BIRDEYE_API_KEY;
  if (!key) throw new Error("BIRDEYE_API_KEY missing");
  return {
    "x-chain": "solana",
    "X-API-KEY": key,
    "accept": "application/json",
  };
}

export type TokenOverview = {
  price: number;
  priceChange24hPct: number;
  volume24hUsd: number;
  liquidityUsd: number;
  marketCapUsd: number;
  holders: number;
};

/**
 * One-shot snapshot for an asker's question target. Best-effort —
 * returns null fields if Birdeye degrades.
 */
export async function getTokenOverview(mint: string): Promise<Partial<TokenOverview>> {
  try {
    const r = await fetch(`${BASE}/defi/token_overview?address=${mint}`, {
      headers: headers(),
      next: { revalidate: 30 },
    });
    if (!r.ok) {
      console.error("[birdeye] overview failed:", r.status);
      return {};
    }
    const json = await r.json();
    const d = json?.data ?? {};
    return {
      price: d.price,
      priceChange24hPct: d.priceChange24hPercent,
      volume24hUsd: d.v24hUSD,
      liquidityUsd: d.liquidity,
      marketCapUsd: d.mc,
      holders: d.holder,
    };
  } catch (err) {
    console.error("[birdeye] getTokenOverview error:", err);
    return {};
  }
}
