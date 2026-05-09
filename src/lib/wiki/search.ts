/**
 * Trade-wiki search. v1 = keyword search (postgres ilike + tag overlap).
 * v2 will add pgvector cosine similarity once we wire up embeddings.
 */
import { dbAdmin } from "../db";

export type WikiHit = {
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
};

export async function searchWiki(query: string, limit = 5): Promise<WikiHit[]> {
  const q = query.trim();
  if (!q) return [];

  const db = dbAdmin();
  const pattern = `%${q.replace(/[%_]/g, "\\$&")}%`;

  const { data, error } = await db
    .from("wiki_entries")
    .select("slug, title, content, tags")
    .or(`title.ilike.${pattern},content.ilike.${pattern}`)
    .limit(limit);

  if (error) {
    console.error("[wiki] search error:", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    slug: row.slug,
    title: row.title,
    excerpt: excerpt(row.content, q),
    tags: row.tags ?? [],
  }));
}

function excerpt(content: string, q: string, padding = 120): string {
  const idx = content.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return content.slice(0, padding * 2) + (content.length > padding * 2 ? "…" : "");
  const start = Math.max(0, idx - padding);
  const end = Math.min(content.length, idx + q.length + padding);
  return (start > 0 ? "…" : "") + content.slice(start, end) + (end < content.length ? "…" : "");
}
