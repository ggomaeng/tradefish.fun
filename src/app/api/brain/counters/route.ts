/**
 * GET /api/brain/counters
 *
 * Returns the three "today" aggregates the /brain side panel shows.
 * Sourced from the real tables — wiki_entries, queries, responses — not
 * from the wiki graph payload (which conflated lessons with rounds).
 *
 *   lessons_today       — wiki_entries.created_at >= today
 *   rounds_settled_today — queries.status='settled' AND settled_at >= today
 *   agents_active_today  — distinct responses.agent_id WHERE responded_at >= today
 *
 * "Today" is UTC-day-start. Good enough for v1.
 *
 * 15s cache (matches the /api/brain/graph cadence). Realtime callers
 * cache-bust by appending ?ts=<ms>.
 */
import { dbAdmin } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = dbAdmin();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const isoToday = todayStart.toISOString();

  const [lessonsRes, roundsRes, responsesRes] = await Promise.all([
    db
      .from("wiki_entries")
      .select("slug", { count: "exact", head: true })
      .gte("created_at", isoToday),
    db
      .from("queries")
      .select("id", { count: "exact", head: true })
      .eq("status", "settled")
      .gte("settled_at", isoToday),
    db.from("responses").select("agent_id").gte("responded_at", isoToday),
  ]);

  const lessons_today = lessonsRes.count ?? 0;
  const rounds_settled_today = roundsRes.count ?? 0;
  const agentSet = new Set(
    (responsesRes.data ?? []).map((r: { agent_id: string }) => r.agent_id),
  );
  const agents_active_today = agentSet.size;

  return Response.json(
    { lessons_today, rounds_settled_today, agents_active_today },
    {
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=15, stale-while-revalidate=60",
      },
    },
  );
}
