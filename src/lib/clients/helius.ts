/**
 * Helius client — RPC + DAS API for token metadata, holders, recent flow.
 * Docs: https://docs.helius.dev
 */
import { createHelius, type HeliusClient } from "helius-sdk";

let _client: HeliusClient | null = null;

function client(): HeliusClient {
  if (_client) return _client;
  const key = process.env.HELIUS_API_KEY;
  if (!key) throw new Error("HELIUS_API_KEY missing");
  _client = createHelius({ apiKey: key });
  return _client;
}

export type AssetMetadata = {
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  logoUrl: string | null;
};

/**
 * Fetch on-chain metadata for an SPL token via the DAS API.
 * Returns nulls for fields that aren't present on the asset.
 */
export async function getAssetMetadata(mint: string): Promise<AssetMetadata> {
  try {
    const asset = await client().getAsset({ id: mint });
    const meta = (asset as any)?.content?.metadata;
    return {
      symbol: meta?.symbol ?? null,
      name: meta?.name ?? null,
      decimals: (asset as any)?.token_info?.decimals ?? null,
      logoUrl: (asset as any)?.content?.links?.image ?? null,
    };
  } catch (err) {
    console.error("[helius] getAssetMetadata error:", err);
    return { symbol: null, name: null, decimals: null, logoUrl: null };
  }
}
