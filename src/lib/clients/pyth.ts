/**
 * Pyth Hermes client — the oracle we settle paper trades against.
 * Hermes is the public price-streaming gateway; no API key required.
 *
 * Docs: https://docs.pyth.network/price-feeds/use-real-time-data/web
 */
import { HermesClient } from "@pythnetwork/hermes-client";

let _client: HermesClient | null = null;

function client(): HermesClient {
  if (_client) return _client;
  const url = process.env.PYTH_HERMES_URL || "https://hermes.pyth.network";
  _client = new HermesClient(url, {});
  return _client;
}

/**
 * Fetch the latest USD price for a Pyth feed ID. Returns null if unavailable.
 *
 * @param feedId 0x-prefixed hex (e.g. SOL/USD = 0xef0d...)
 */
export async function getPythPrice(feedId: string): Promise<number | null> {
  try {
    const updates = await client().getLatestPriceUpdates([feedId]);
    const p = updates?.parsed?.[0]?.price;
    if (!p) return null;
    // Pyth prices are stored as integer + exponent. price = mantissa * 10^expo
    const mantissa = Number(p.price);
    const expo = Number(p.expo);
    return mantissa * Math.pow(10, expo);
  } catch (err) {
    console.error("[pyth] getPythPrice error:", err);
    return null;
  }
}

/**
 * Fetch latest prices for many feeds in one call. Returns a map of feedId → price.
 */
export async function getPythPrices(feedIds: string[]): Promise<Record<string, number>> {
  if (feedIds.length === 0) return {};
  try {
    const updates = await client().getLatestPriceUpdates(feedIds);
    const out: Record<string, number> = {};
    for (const item of updates?.parsed ?? []) {
      const id = item.id.startsWith("0x") ? item.id : `0x${item.id}`;
      const mantissa = Number(item.price.price);
      const expo = Number(item.price.expo);
      out[id] = mantissa * Math.pow(10, expo);
    }
    return out;
  } catch (err) {
    console.error("[pyth] getPythPrices error:", err);
    return {};
  }
}
