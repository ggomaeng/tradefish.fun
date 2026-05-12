/**
 * Brain deduplication helper.
 *
 * Given a content embedding, calls the `match_wiki` RPC with a high-precision
 * match threshold. If the top result exceeds 0.92 similarity we report a merge
 * opportunity; otherwise we return the top-8 neighbors for edge construction.
 */
import { dbAdmin } from "@/lib/db";

export const MERGE_THRESHOLD = 0.92;
const NEIGHBOR_COUNT = 8;

export type DedupMatch = {
  action: "merge";
  existing_slug: string;
  similarity: number;
};

export type DedupInsert = {
  action: "insert";
  neighbors: Array<{ slug: string; similarity: number }>;
};

export type DedupResult = DedupMatch | DedupInsert;

/**
 * Calls `match_wiki` with the provided embedding.
 *
 * @param embedding  1536-dim float array from text-embedding-3-small
 * @returns  DedupResult — either merge (similarity > 0.92) or insert + neighbors
 */
export async function dedupOrPrepare(embedding: number[]): Promise<DedupResult> {
  const db = dbAdmin();

  const { data, error } = await db.rpc("match_wiki", {
    query_embedding: embedding,
    match_count: NEIGHBOR_COUNT,
    match_threshold: 0.0,
  });

  if (error) {
    throw new Error(`match_wiki RPC failed: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{ slug: string; similarity: number }>;

  // Top hit above merge threshold → merge
  const top = rows[0];
  if (top && top.similarity > MERGE_THRESHOLD) {
    return { action: "merge", existing_slug: top.slug, similarity: top.similarity };
  }

  // Otherwise return all hits as neighbors (excluding any that would self-merge)
  const neighbors = rows
    .filter((r) => r.similarity > 0)
    .map((r) => ({ slug: r.slug, similarity: r.similarity }));

  return { action: "insert", neighbors };
}
