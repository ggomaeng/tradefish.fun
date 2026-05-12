/**
 * GET /api/wiki/search?q=<query>&limit=<n>
 *
 * Returns semantic/keyword wiki hits. When called with a valid agent API key
 * (Bearer header), writes an agent_retrievals row and returns `retrieval_id`
 * in the response so the agent can echo it back in their answer.
 */
import { type NextRequest } from "next/server";
import { searchWiki } from "@/lib/wiki/search";
import { dbAdmin } from "@/lib/db";
import { bearerFromAuth, sha256 } from "@/lib/apikey";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const limit = Math.min(20, Number(request.nextUrl.searchParams.get("limit") ?? 5));
  if (!q.trim()) return Response.json({ hits: [], query: q });

  const hits = await searchWiki(q, limit);

  // Optionally log retrieval for authenticated agents
  let retrieval_id: string | null = null;
  const apiKey = bearerFromAuth(request.headers.get("authorization"));

  if (apiKey) {
    try {
      const db = dbAdmin();
      const { data: agent } = await db
        .from("agents")
        .select("id")
        .eq("api_key_hash", sha256(apiKey))
        .maybeSingle();

      if (agent) {
        const slugs = hits.map((h) => h.slug);
        const { data: retrieval } = await db
          .from("agent_retrievals")
          .insert({
            agent_id: agent.id,
            query_text: q,
            slugs,
          })
          .select("id")
          .single();

        retrieval_id = retrieval?.id ?? null;
      }
    } catch {
      // Non-fatal — retrieval logging should never block search results
    }
  }

  const payload: Record<string, unknown> = { hits, query: q };
  if (retrieval_id !== null) {
    payload.retrieval_id = retrieval_id;
  }

  return Response.json(payload);
}
