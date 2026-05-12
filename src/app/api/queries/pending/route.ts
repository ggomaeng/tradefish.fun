/**
 * GET /api/queries/pending
 * Auth: Bearer <api_key>
 *
 * Returns active rounds the agent has not yet answered. Used by polling-mode agents
 * (e.g. agents running on a personal machine like OpenClaw that can't expose HTTPS).
 *
 * Payload includes per-round CONTEXT so even minimal agents can do real analysis
 * without having to fetch Pyth themselves or maintain their own history:
 *   - `pyth_price_at_ask`: the round's entry price (locked at ask time).
 *   - `context.recent_rounds`: up to 5 prior settled rounds on the same token,
 *     with entry/close prices and swarm consensus direction. Lets agents read
 *     recent momentum + see what the swarm collectively thought last time.
 */
import { type NextRequest } from "next/server";
import { dbAdmin } from "@/lib/db";
import { bearerFromAuth, sha256 } from "@/lib/apikey";
import { apiError, requestId } from "@/lib/api-error";

export const dynamic = "force-dynamic";

interface RecentRound {
  asked_at: string;
  settled_at: string | null;
  entry_price: number;
  close_price: number | null;
  pnl_pct: number | null;
  swarm_consensus: { buy: number; sell: number; hold: number } | null;
}

export async function GET(request: NextRequest) {
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
    .select("id")
    .eq("api_key_hash", sha256(apiKey))
    .maybeSingle();

  if (!agent) {
    return apiError({
      error: "invalid_key",
      code: "invalid_key",
      status: 401,
      request_id: rid,
    });
  }

  // Mark agent as alive
  await db
    .from("agents")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", agent.id);

  // Active rounds (deadline not passed) that this agent hasn't answered yet.
  const nowIso = new Date().toISOString();
  const { data: queries } = await db
    .from("queries")
    .select(
      `
      short_id,
      token_mint,
      question_type,
      asked_at,
      deadline_at,
      pyth_price_at_ask,
      supported_tokens!inner(symbol, name),
      responses!left(agent_id)
    `,
    )
    .gt("deadline_at", nowIso)
    .order("asked_at", { ascending: false })
    .limit(20);

  const unanswered = (queries ?? []).filter(
    (q: any) => !q.responses?.some((r: any) => r.agent_id === agent.id),
  );

  // ── Context enrichment ──
  // For each unique token in the unanswered set, fetch the last 5 settled
  // rounds with their close prices and swarm direction consensus. One batched
  // query per token is cheap (≤6 distinct tokens in practice, indexed lookup).
  const tokenMints = Array.from(
    new Set(unanswered.map((q: any) => q.token_mint).filter(Boolean)),
  );
  const recentByToken = new Map<string, RecentRound[]>();

  if (tokenMints.length > 0) {
    const { data: priorRounds } = await db
      .from("queries")
      .select(
        `
        token_mint,
        asked_at,
        settled_at,
        pyth_price_at_ask,
        close_price_pyth,
        responses(direction)
      `,
      )
      .in("token_mint", tokenMints)
      .eq("status", "settled")
      .not("close_price_pyth", "is", null)
      .order("settled_at", { ascending: false })
      .limit(tokenMints.length * 5);

    for (const mint of tokenMints) {
      const rows = (priorRounds ?? [])
        .filter((r: any) => r.token_mint === mint)
        .slice(0, 5);
      recentByToken.set(
        mint as string,
        rows.map((r: any): RecentRound => {
          const entry = Number(r.pyth_price_at_ask);
          const close =
            r.close_price_pyth === null ? null : Number(r.close_price_pyth);
          const pnlPct =
            close !== null && entry > 0
              ? ((close - entry) / entry) * 100
              : null;
          const dirs = (r.responses ?? []).map((x: any) => x.direction);
          const consensus = dirs.length
            ? {
                buy: dirs.filter((d: string) => d === "buy").length,
                sell: dirs.filter((d: string) => d === "sell").length,
                hold: dirs.filter((d: string) => d === "hold").length,
              }
            : null;
          return {
            asked_at: r.asked_at,
            settled_at: r.settled_at,
            entry_price: entry,
            close_price: close,
            pnl_pct: pnlPct,
            swarm_consensus: consensus,
          };
        }),
      );
    }
  }

  const filtered = unanswered.map((q: any) => ({
    query_id: q.short_id,
    token: {
      mint: q.token_mint,
      symbol: q.supported_tokens.symbol,
      name: q.supported_tokens.name,
    },
    question: q.question_type,
    asked_at: q.asked_at,
    deadline_at: q.deadline_at,
    pyth_price_at_ask:
      q.pyth_price_at_ask === null ? null : Number(q.pyth_price_at_ask),
    context: {
      recent_rounds: recentByToken.get(q.token_mint) ?? [],
    },
  }));

  return Response.json({ queries: filtered });
}
