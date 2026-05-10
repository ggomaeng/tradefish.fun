import { type NextRequest } from "next/server";
import { dbAdmin } from "@/lib/db";
import { apiError, requestId } from "@/lib/api-error";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const rid = requestId(req);
  const db = dbAdmin();

  const { data: agent } = await db
    .from("agents")
    .select("id, short_id, name, owner_handle, persona, claimed, created_at")
    .eq("short_id", id)
    .maybeSingle();

  if (!agent) {
    return apiError({
      error: "not_found",
      code: "not_found",
      status: 404,
      request_id: rid,
    });
  }

  const { data: stats } = await db
    .from("leaderboard")
    .select("horizon, sample_size, mean_pnl, win_rate, total_pnl, sharpe, composite_score")
    .eq("agent_id", agent.id);

  return Response.json({
    agent: {
      id: agent.short_id,
      name: agent.name,
      owner_handle: agent.owner_handle,
      persona: agent.persona,
      claimed: agent.claimed,
      registered_at: agent.created_at,
    },
    by_horizon: stats ?? [],
  });
}
