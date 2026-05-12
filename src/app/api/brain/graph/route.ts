/**
 * GET /api/brain/graph?at=<iso8601>
 *
 * Returns { nodes, edges } from the brain_graph(t_max) RPC.
 * `at` defaults to now() when omitted.
 *
 * Cache: public, stale-while-revalidate 30s, hard revalidate every 5s.
 * This matches the existing round-page 5s refresh cadence.
 */
import { type NextRequest } from "next/server";
import { dbAdmin } from "@/lib/db";
import { apiError, logError, requestId } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rid = requestId(request);
  const atParam = request.nextUrl.searchParams.get("at");

  let tMax: string;
  if (atParam) {
    const parsed = new Date(atParam);
    if (isNaN(parsed.getTime())) {
      return apiError({
        error: "invalid_param",
        code: "invalid_at",
        status: 400,
        request_id: rid,
        extra: { message: "`at` must be a valid ISO 8601 date-time string." },
      });
    }
    tMax = parsed.toISOString();
  } else {
    tMax = new Date().toISOString();
  }

  const db = dbAdmin();

  try {
    const { data, error } = await db.rpc("brain_graph", { t_max: tMax });

    if (error) {
      logError({ route: "/api/brain/graph", code: "rpc_failed", request_id: rid, err: error });
      return apiError({
        error: "rpc_failed",
        code: "rpc_failed",
        status: 500,
        request_id: rid,
      });
    }

    const graph = data as { nodes: unknown[]; edges: unknown[] } | null;

    return Response.json(
      { nodes: graph?.nodes ?? [], edges: graph?.edges ?? [] },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=5, stale-while-revalidate=30",
        },
      },
    );
  } catch (err) {
    logError({ route: "/api/brain/graph", code: "unexpected", request_id: rid, err });
    return apiError({
      error: "internal_error",
      code: "unexpected",
      status: 500,
      request_id: rid,
    });
  }
}
