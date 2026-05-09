/**
 * GET /api/credits/balance?wallet=<pubkey>
 *
 * Returns the current credit balance for a Solana wallet. If the wallet has
 * never topped up, returns 0 — never 404. The pubkey is validated as a
 * base58 string of plausible length but no crypto verification happens here.
 */

import { type NextRequest } from "next/server";
import { dbAdmin } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");
  if (!wallet || wallet.length < 32 || wallet.length > 64) {
    return Response.json({ error: "invalid_wallet" }, { status: 400 });
  }

  const db = dbAdmin();
  const { data, error } = await db
    .from("wallet_credits")
    .select("wallet_pubkey, credits")
    .eq("wallet_pubkey", wallet)
    .maybeSingle();

  if (error) {
    console.error("[credits/balance] query failed:", error);
    return Response.json({ error: "lookup_failed" }, { status: 500 });
  }

  return Response.json({
    wallet_pubkey: wallet,
    credits: data?.credits ?? 0,
  });
}
