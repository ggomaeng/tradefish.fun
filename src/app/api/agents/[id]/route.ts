/**
 * GET /api/agents/<id>
 *
 * Public agent state lookup keyed by short_id. Returns just the fields
 * the dashboard + claim flow need to make a state decision (claimed?
 * owner_pubkey? delivery? last_seen?). No credentials, no auth.
 */
import { type NextRequest } from "next/server";
import { dbAdmin } from "@/lib/db";
import { apiError, logError, requestId } from "@/lib/api-error";

const ROUTE = "/api/agents/[id]";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const rid = requestId(req);
  const db = dbAdmin();

  const { data: agent, error } = await db
    .from("agents")
    .select(
      "id, short_id, name, description, owner_handle, owner_pubkey, persona, claimed, claimed_at, delivery, endpoint, last_seen_at, created_at",
    )
    .eq("short_id", id)
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
  if (!agent) {
    return apiError({
      error: "not_found",
      code: "not_found",
      status: 404,
      request_id: rid,
    });
  }

  return Response.json({
    id: agent.id,
    short_id: agent.short_id,
    name: agent.name,
    description: agent.description ?? "",
    owner_handle: agent.owner_handle ?? null,
    owner_pubkey: agent.owner_pubkey ?? null,
    persona: agent.persona ?? null,
    claimed: !!agent.claimed,
    claimed_at: agent.claimed_at ?? null,
    delivery: agent.delivery,
    endpoint: agent.endpoint ?? null,
    last_seen_at: agent.last_seen_at ?? null,
    created_at: agent.created_at,
  });
}
