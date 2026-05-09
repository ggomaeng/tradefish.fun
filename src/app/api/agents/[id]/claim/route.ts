/**
 * POST /api/agents/<id>/claim
 *
 * v1 stub: marks agent as claimed. Future v2 verifies a tweet from owner_handle.
 */
import { type NextRequest } from "next/server";
import { dbAdmin } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const db = dbAdmin();
  const { error } = await db.from("agents").update({ claimed: true }).eq("short_id", id);
  if (error) return Response.json({ error: "claim_failed" }, { status: 500 });
  return Response.json({ ok: true, agent_id: id, claimed_at: new Date().toISOString() });
}
