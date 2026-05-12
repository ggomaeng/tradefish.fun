/**
 * GET /api/brain/retrieval/:id
 *
 * Returns:
 *   - The agent_retrievals row (query_text, slugs, created_at)
 *   - The agent that performed the retrieval (id, name)
 *   - If any response cited any of those slugs within 60s of the retrieval:
 *     the response details + associated PnL
 *
 * Used for "retrieval replay" in the Brain UI — clicking an answer shows
 * exactly what the agent consulted and whether it worked.
 */
import { type NextRequest } from "next/server";
import { dbAdmin } from "@/lib/db";
import { apiError, logError, requestId } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const ATTRIBUTION_WINDOW_SECONDS = 60;

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const rid = requestId(request);

  // Validate id is UUID-shaped
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) {
    return apiError({ error: "invalid_param", code: "invalid_id", status: 400, request_id: rid });
  }

  const db = dbAdmin();

  try {
    // 1. Fetch the retrieval row + agent
    const { data: retrieval, error: retErr } = await db
      .from("agent_retrievals")
      .select("id, agent_id, query_text, slugs, created_at")
      .eq("id", id)
      .maybeSingle();

    if (retErr) {
      logError({ route: "/api/brain/retrieval/[id]", code: "fetch_failed", request_id: rid, err: retErr });
      return apiError({ error: "fetch_failed", code: "fetch_failed", status: 500, request_id: rid });
    }

    if (!retrieval) {
      return apiError({ error: "not_found", code: "retrieval_not_found", status: 404, request_id: rid });
    }

    // 2. Agent info
    let agent: { id: string; name: string } | null = null;
    if (retrieval.agent_id) {
      const { data: agentRow } = await db
        .from("agents")
        .select("id, name")
        .eq("id", retrieval.agent_id)
        .maybeSingle();
      agent = agentRow ?? null;
    }

    // 3. Find responses that cited any of the retrieved slugs within 60s
    let linkedAnswers: unknown[] = [];
    if (retrieval.slugs && retrieval.slugs.length > 0) {
      const retrievalTime = new Date(retrieval.created_at);
      const windowEnd = new Date(
        retrievalTime.getTime() + ATTRIBUTION_WINDOW_SECONDS * 1000,
      ).toISOString();

      // Find answer_citations for any of these slugs where the response was
      // submitted by the same agent within the attribution window.
      const { data: citations } = await db
        .from("answer_citations")
        .select(
          `answer_id, slug, source, weight,
           responses!answer_id(
             id, answer, confidence, reasoning, responded_at, agent_id,
             query_id,
             queries!query_id(id, short_id, token_mint, asked_at)
           )`,
        )
        .in("slug", retrieval.slugs);

      // Filter: response must be from the same agent and within attribution window
      linkedAnswers = (citations ?? [])
        .filter((c) => {
          const r = (c as Record<string, unknown>)["responses"] as Record<string, unknown> | null;
          if (!r) return false;
          if (r["agent_id"] !== retrieval.agent_id) return false;
          const respondedAt = new Date(r["responded_at"] as string);
          return (
            respondedAt >= retrievalTime &&
            respondedAt <= new Date(windowEnd)
          );
        })
        .map((c) => ({
          answer_id: c.answer_id,
          slug: c.slug,
          source: c.source,
          weight: c.weight,
          response: (c as Record<string, unknown>)["responses"],
        }));
    }

    return Response.json({
      retrieval: {
        id: retrieval.id,
        query_text: retrieval.query_text,
        slugs: retrieval.slugs,
        created_at: retrieval.created_at,
      },
      agent,
      linked_answers: linkedAnswers,
    });
  } catch (err) {
    logError({ route: "/api/brain/retrieval/[id]", code: "unexpected", request_id: rid, err });
    return apiError({ error: "internal_error", code: "unexpected", status: 500, request_id: rid });
  }
}
