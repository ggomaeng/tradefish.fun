import { type NextRequest } from "next/server";
import { searchWiki } from "@/lib/wiki/search";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const limit = Math.min(20, Number(request.nextUrl.searchParams.get("limit") ?? 5));
  if (!q.trim()) return Response.json({ hits: [] });
  const hits = await searchWiki(q, limit);
  return Response.json({ hits, query: q });
}
