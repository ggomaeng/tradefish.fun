/**
 * GET /api/brain/note/:slug
 *
 * Returns the full note plus:
 *   - top 5 co-cited slugs (from note_edges, ordered by co_cite_count desc)
 *   - last 10 responses that cited it (join answer_citations + responses + queries)
 */
import { type NextRequest } from "next/server";
import { dbAdmin } from "@/lib/db";
import { apiError, logError, requestId } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const rid = requestId(request);
  const db = dbAdmin();

  try {
    // 1. Fetch the note itself
    const { data: note, error: noteErr } = await db
      .from("wiki_entries")
      .select(
        "slug, title, content, tokens, tags, pnl_attributed_usd, cite_count, created_at, author_agent_id, source_round_id",
      )
      .eq("slug", slug)
      .maybeSingle();

    if (noteErr) {
      logError({ route: "/api/brain/note/[slug]", code: "note_fetch_failed", request_id: rid, err: noteErr });
      return apiError({ error: "fetch_failed", code: "note_fetch_failed", status: 500, request_id: rid });
    }

    if (!note) {
      return apiError({ error: "not_found", code: "note_not_found", status: 404, request_id: rid });
    }

    // 2. Top 5 co-cited slugs via note_edges
    //    An edge exists where from_slug=slug OR to_slug=slug (undirected).
    const { data: fromEdges } = await db
      .from("note_edges")
      .select("from_slug, to_slug, co_cite_count, similarity, pnl_flow_usd")
      .eq("to_slug", slug)
      .order("co_cite_count", { ascending: false })
      .limit(5);

    const { data: toEdges } = await db
      .from("note_edges")
      .select("from_slug, to_slug, co_cite_count, similarity, pnl_flow_usd")
      .eq("from_slug", slug)
      .order("co_cite_count", { ascending: false })
      .limit(5);

    type EdgeRow = {
      from_slug: string;
      to_slug: string;
      co_cite_count: number;
      similarity: number;
      pnl_flow_usd: number;
    };

    const allEdges: EdgeRow[] = [...(fromEdges ?? []), ...(toEdges ?? [])];
    // sort combined, pick top 5
    const relatedNotes = allEdges
      .sort((a, b) => (b.co_cite_count ?? 0) - (a.co_cite_count ?? 0))
      .slice(0, 5)
      .map((e) => ({
        slug: e.from_slug === slug ? e.to_slug : e.from_slug,
        co_cite_count: e.co_cite_count,
        similarity: e.similarity,
        pnl_flow_usd: e.pnl_flow_usd,
      }));

    // 3. Last 10 responses that cited this note
    const { data: citations } = await db
      .from("answer_citations")
      .select(
        `answer_id, source, weight,
         responses!answer_id(
           id, answer, confidence, reasoning, responded_at,
           agent_id,
           queries!query_id(id, short_id, token_mint, asked_at)
         )`,
      )
      .eq("slug", slug)
      .order("answer_id", { ascending: false })
      .limit(10);

    const recentAnswers = (citations ?? []).map((c) => {
      const row = c as {
        answer_id: string;
        source: string;
        weight: number;
        responses?: unknown;
      };
      return {
        answer_id: row.answer_id,
        source: row.source,
        weight: row.weight,
        response: row.responses ?? null,
      };
    });

    return Response.json({
      note,
      related_notes: relatedNotes,
      recent_answers: recentAnswers,
    });
  } catch (err) {
    logError({ route: "/api/brain/note/[slug]", code: "unexpected", request_id: rid, err });
    return apiError({ error: "internal_error", code: "unexpected", status: 500, request_id: rid });
  }
}
