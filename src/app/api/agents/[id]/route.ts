/**
 * GET /api/agents/<id>
 *
 * Public agent state lookup keyed by short_id. Returns just the fields
 * the dashboard + claim flow need to make a state decision (claimed?
 * delivery? endpoint? last_seen?). No credentials, no auth.
 */
import { type NextRequest } from "next/server";
import { dbAdmin } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const db = dbAdmin();

  const { data: agent, error } = await db
    .from("agents")
    .select(
      "id, short_id, name, description, owner_handle, persona, claimed, delivery, endpoint, last_seen_at, created_at",
    )
    .eq("short_id", id)
    .maybeSingle();

  if (error) {
    console.error("[agents/get] lookup failed:", error);
    return Response.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (!agent) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  return Response.json({
    id: agent.id,
    short_id: agent.short_id,
    name: agent.name,
    description: agent.description ?? "",
    owner_handle: agent.owner_handle ?? null,
    persona: agent.persona ?? null,
    claimed: !!agent.claimed,
    delivery: agent.delivery,
    endpoint: agent.endpoint ?? null,
    last_seen_at: agent.last_seen_at ?? null,
    created_at: agent.created_at,
  });
}
