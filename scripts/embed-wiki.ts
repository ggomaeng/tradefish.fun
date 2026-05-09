/**
 * Embed every markdown file in src/content/wiki/ and upsert into wiki_entries.
 *
 * Run with: npx tsx scripts/embed-wiki.ts (or `npm run embed:wiki`).
 *
 * Required env:
 *   - OPENAI_API_KEY                    (text-embedding-3-small)
 *   - NEXT_PUBLIC_SUPABASE_URL          (used by dbAdmin)
 *   - SUPABASE_SERVICE_ROLE_KEY         (used by dbAdmin)
 *
 * Idempotent: upserts on `slug`. Safe to re-run after editing markdown.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import OpenAI from "openai";
import { dbAdmin } from "../src/lib/db";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WIKI_DIR = join(__dirname, "..", "src", "content", "wiki");
const EMBED_MODEL = "text-embedding-3-small"; // 1536 dims — matches wiki_entries.embedding

function humanize(filename: string): string {
  // "001-pyth-settlement" → "Pyth Settlement"
  return filename
    .replace(/^\d+-/, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[embed-wiki] OPENAI_API_KEY missing — set it and re-run");
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });
  const db = dbAdmin();

  const files = readdirSync(WIKI_DIR).filter((f) => f.endsWith(".md"));
  if (files.length === 0) {
    console.warn(`[embed-wiki] no .md files found in ${WIKI_DIR}`);
    return;
  }

  let ok = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fullPath = join(WIKI_DIR, file);
    const raw = readFileSync(fullPath, "utf-8");
    const parsed = matter(raw);
    const fm = parsed.data as { slug?: string; title?: string; tags?: string[] };
    const fileBase = basename(file, ".md");

    const slug = (fm.slug ?? fileBase).trim();
    const title = (fm.title ?? humanize(fileBase)).trim();
    const body = parsed.content.trim();
    const tags = Array.isArray(fm.tags) ? fm.tags : [];

    try {
      const { data: embeds } = await client.embeddings.create({
        model: EMBED_MODEL,
        input: `${title}\n\n${body}`,
      });
      const embedding = embeds[0]?.embedding;
      if (!embedding) throw new Error("no embedding returned");

      const { error } = await db
        .from("wiki_entries")
        .upsert(
          {
            slug,
            title,
            content: body,
            embedding: embedding as unknown as number[],
            tags,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "slug" }
        );

      if (error) throw error;

      ok++;
      console.log(`[embed-wiki] embedded ${i + 1}/${files.length}: ${slug}`);
    } catch (err) {
      failed++;
      console.error(`[embed-wiki] failed ${i + 1}/${files.length}: ${slug} —`, err);
    }
  }

  console.log(`[embed-wiki] done. ok=${ok} failed=${failed} total=${files.length}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("[embed-wiki] fatal:", err);
  process.exit(1);
});
