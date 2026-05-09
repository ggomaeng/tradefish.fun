import { type NextRequest } from "next/server";
import { dbAdmin } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const db = dbAdmin();

  const { data: agent } = await db
    .from("agents")
    .select("id, short_id, name, owner_handle, persona, claimed, created_at")
    .eq("short_id", id)
    .maybeSingle();

  if (!agent) return Response.json({ error: "not_found" }, { status: 404 });

  const { data: stats } = await db
    .from("leaderboard")
    .select("window, sample_size, mean_pnl, win_rate, total_pnl, sharpe, composite_score")
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
    by_window: stats ?? [],
  });
}
