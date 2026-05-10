/**
 * GET /api/credits/balance?wallet=<pubkey>
 *
 * Returns the current credit balance for a Solana wallet. If the wallet has
 * never topped up, returns 0 — never 404. The pubkey is validated as a
 * base58 string of plausible length but no crypto verification happens here.
 */

import { type NextRequest } from "next/server";
import { dbAdmin } from "@/lib/db";
import { apiError, logError, requestId } from "@/lib/api-error";

const ROUTE = "/api/credits/balance";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rid = requestId(request);
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");
  if (!wallet || wallet.length < 32 || wallet.length > 64) {
    return apiError({
      error: "invalid_wallet",
      code: "invalid_wallet",
      status: 400,
      request_id: rid,
    });
  }

  const db = dbAdmin();
  const { data, error } = await db
    .from("wallet_credits")
    .select("wallet_pubkey, credits")
    .eq("wallet_pubkey", wallet)
    .maybeSingle();

  if (error) {
    logError({ route: ROUTE, code: "lookup_failed", request_id: rid, err: error });
    return apiError({
      error: "lookup_failed",
      code: "lookup_failed",
      status: 500,
      request_id: rid,
    });
  }

  return Response.json({
    wallet_pubkey: wallet,
    credits: data?.credits ?? 0,
  });
}
