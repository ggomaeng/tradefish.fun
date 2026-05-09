/**
 * Jupiter price + quote client. Public API, no key required.
 * Docs: https://station.jup.ag/docs/apis/price-api
 */
const BASE = process.env.JUPITER_API_URL || "https://api.jup.ag";

export type JupPrice = {
  id: string;       // mint address
  type: string;     // 'derivedPrice' | 'buyPrice' | etc.
  price: string;    // USD price as string
};

/**
 * Fetch USD prices for one or more Solana token mints.
 * Returns a map { mint → usd_price }.
 */
export async function getJupPrices(mints: string[]): Promise<Record<string, number>> {
  if (mints.length === 0) return {};
  try {
    const url = `${BASE}/price/v3?ids=${mints.join(",")}`;
    const r = await fetch(url, { next: { revalidate: 5 } });
    if (!r.ok) {
      console.error("[jupiter] price fetch failed:", r.status, await r.text());
      return {};
    }
    const json = (await r.json()) as { data: Record<string, JupPrice> };
    const out: Record<string, number> = {};
    for (const [mint, p] of Object.entries(json.data ?? {})) {
      const v = Number(p.price);
      if (Number.isFinite(v)) out[mint] = v;
    }
    return out;
  } catch (err) {
    console.error("[jupiter] getJupPrices error:", err);
    return {};
  }
}
