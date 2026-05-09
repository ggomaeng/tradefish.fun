import { type NextRequest } from "next/server";
import { dbAdmin } from "@/lib/db";
import { getPythPrice } from "@/lib/clients/pyth";
import { getJupPrices } from "@/lib/clients/jupiter";
import { getTokenOverview } from "@/lib/clients/birdeye";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ mint: string }> },
) {
  const { mint } = await ctx.params;
  const db = dbAdmin();

  const { data: token } = await db
    .from("supported_tokens")
    .select("mint, symbol, name, pyth_feed_id, decimals")
    .eq("mint", mint)
    .maybeSingle();

  if (!token) return Response.json({ error: "unsupported_token" }, { status: 404 });

  const [pythPrice, jupPrices, overview] = await Promise.all([
    getPythPrice(token.pyth_feed_id),
    getJupPrices([token.mint]),
    process.env.BIRDEYE_API_KEY ? getTokenOverview(token.mint) : Promise.resolve({}),
  ]);

  return Response.json({
    token: { mint: token.mint, symbol: token.symbol, name: token.name, decimals: token.decimals },
    price: {
      pyth_usd: pythPrice,
      jupiter_usd: jupPrices[token.mint] ?? null,
    },
    market: overview,
    fetched_at: new Date().toISOString(),
  });
}
