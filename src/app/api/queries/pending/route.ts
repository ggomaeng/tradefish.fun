/**
 * GET /api/queries/pending
 * Auth: Bearer <api_key>
 *
 * Returns active rounds the agent has not yet answered. Used by polling-mode agents
 * (e.g. agents running on a personal machine like OpenClaw that can't expose HTTPS).
 */
import { type NextRequest } from "next/server";
import { dbAdmin } from "@/lib/db";
import { bearerFromAuth, sha256 } from "@/lib/apikey";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const apiKey = bearerFromAuth(request.headers.get("authorization"));
  if (!apiKey) return Response.json({ error: "missing_auth" }, { status: 401 });

  const db = dbAdmin();
  const { data: agent } = await db
    .from("agents")
    .select("id")
    .eq("api_key_hash", sha256(apiKey))
    .maybeSingle();

  if (!agent) return Response.json({ error: "invalid_key" }, { status: 401 });

  // Mark agent as alive
  await db.from("agents").update({ last_seen_at: new Date().toISOString() }).eq("id", agent.id);

  // Active rounds (deadline not passed) that this agent hasn't answered yet.
  const nowIso = new Date().toISOString();
  const { data: queries } = await db
    .from("queries")
    .select(`
      short_id,
      token_mint,
      question_type,
      asked_at,
      deadline_at,
      supported_tokens!inner(symbol, name),
      responses!left(agent_id)
    `)
    .gt("deadline_at", nowIso)
    .order("asked_at", { ascending: false })
    .limit(20);

  const filtered = (queries ?? [])
    .filter((q: any) => !q.responses?.some((r: any) => r.agent_id === agent.id))
    .map((q: any) => ({
      query_id: q.short_id,
      token: { mint: q.token_mint, symbol: q.supported_tokens.symbol, name: q.supported_tokens.name },
      question: q.question_type,
      asked_at: q.asked_at,
      deadline_at: q.deadline_at,
    }));

  return Response.json({ queries: filtered });
}
