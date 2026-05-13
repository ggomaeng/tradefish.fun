/**
 * POST /api/agents/me/revive
 * Auth: Bearer <api_key>
 * No body required.
 *
 * Restores a bust agent's bankroll to DEFAULT_BANKROLL_USD when
 * bankroll_usd < BANKROLL_REVIVE_THRESHOLD_USD. Increments revival_count on each
 * successful revive. Returns 409 not_bust_yet otherwise.
 */
import { type NextRequest } from "next/server";
import { dbAdmin } from "@/lib/db";
import { bearerFromAuth, sha256 } from "@/lib/apikey";
import { apiError, logError, requestId } from "@/lib/api-error";
import { BANKROLL_REVIVE_THRESHOLD_USD, DEFAULT_BANKROLL_USD } from "@/lib/settlement";

const ROUTE = "/api/agents/me/revive";

export async function POST(request: NextRequest) {
  const rid = requestId(request);

  const apiKey = bearerFromAuth(request.headers.get("authorization"));
  if (!apiKey) {
    return apiError({
      error: "missing_auth",
      code: "missing_auth",
      status: 401,
      request_id: rid,
    });
  }

  const db = dbAdmin();

  const { data: agent } = await db
    .from("agents")
    .select("id, bankroll_usd, revival_count")
    .eq("api_key_hash", sha256(apiKey))
    .maybeSingle();

  if (!agent) {
    return apiError({
      error: "agent_not_found",
      code: "agent_not_found",
      status: 404,
      request_id: rid,
    });
  }

  const bankroll = agent.bankroll_usd as number;

  if (bankroll >= BANKROLL_REVIVE_THRESHOLD_USD) {
    return apiError({
      error: "not_bust_yet",
      code: "not_bust_yet",
      status: 409,
      request_id: rid,
      extra: { bankroll_usd: bankroll },
    });
  }

  // Atomic update: guard on bankroll_usd < BANKROLL_REVIVE_THRESHOLD_USD to prevent double-revive races.
  const { data: updated, error } = await db
    .from("agents")
    .update({
      bankroll_usd: DEFAULT_BANKROLL_USD,
      revival_count: (agent.revival_count as number) + 1,
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", agent.id)
    .lt("bankroll_usd", BANKROLL_REVIVE_THRESHOLD_USD)
    .select("bankroll_usd, revival_count")
    .single();

  if (error || !updated) {
    // Race condition: another revive landed first and bankroll is now >= BANKROLL_REVIVE_THRESHOLD_USD.
    // Re-fetch and return not_bust_yet.
    logError({ route: ROUTE, code: "revive_race_or_db_error", request_id: rid, err: error });
    return apiError({
      error: "not_bust_yet",
      code: "not_bust_yet",
      status: 409,
      request_id: rid,
    });
  }

  console.error(
    JSON.stringify({
      level: "info",
      route: ROUTE,
      agent_id: agent.id,
      revival_count: updated.revival_count,
      request_id: rid,
    }),
  );

  return Response.json(
    {
      bankroll_usd: updated.bankroll_usd,
      revival_count: updated.revival_count,
    },
    { status: 200 },
  );
}
