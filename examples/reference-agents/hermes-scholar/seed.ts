/**
 * seed.ts — one-shot seeder for the tradefish wiki corpus.
 *
 * Reads ./wiki/*.md (shipped alongside this script), parses the YAML
 * frontmatter, embeds title+content via text-embedding-3-small, and upserts
 * into wiki_entries by slug. Hand-authored priors only — runs separately
 * from the live scholar polling loop (index.ts).
 *
 * Why this lives on taco: reuses the OPENAI_API_KEY and SUPABASE service-role
 * credentials Hermes already has wired. No platform-endpoint dependency, no
 * local OPENAI_API_KEY required on the developer's laptop.
 *
 * Run: `npx tsx seed.ts`
 * Idempotent — re-running updates content + embedding for any slug whose
 * markdown changed upstream. Re-scp the wiki/ dir from the repo when seeds
 * are added or edited.
 */

import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const WIKI_DIR = join(dirname(fileURLToPath(import.meta.url)), "wiki");

const {
  OPENAI_API_KEY,
  OPENAI_BASE_URL,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing in .env");
if (!SUPABASE_URL) throw new Error("SUPABASE_URL missing in .env");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing in .env");

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  ...(OPENAI_BASE_URL ? { baseURL: OPENAI_BASE_URL } : {}),
});
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type Frontmatter = {
  slug: string;
  title: string;
  tags: string[];
  tokens?: string[];
};

function parseFrontmatter(md: string): { fm: Frontmatter; body: string } {
  const match = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) throw new Error("no frontmatter delimiters");
  const yaml = match[1];
  const body = match[2].trim();

  const out: Record<string, unknown> = {};
  for (const line of yaml.split("\n")) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].trim();
    const raw = m[2].trim();
    // simple flow-list parse: tags: [a, b, c]
    if (raw.startsWith("[") && raw.endsWith("]")) {
      out[key] = raw
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      out[key] = raw.replace(/^["']|["']$/g, "");
    }
  }

  const slug = String(out.slug ?? "").trim();
  const title = String(out.title ?? "").trim();
  if (!slug || !title) throw new Error("missing slug or title");
  const tags = Array.isArray(out.tags) ? (out.tags as string[]) : [];
  const tokens = Array.isArray(out.tokens) ? (out.tokens as string[]) : undefined;

  return { fm: { slug, title, tags, tokens }, body };
}

async function embed(text: string): Promise<number[]> {
  const r = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  const v = r.data[0]?.embedding;
  if (!v) throw new Error("no embedding returned");
  return v;
}

async function seedOne(filename: string): Promise<"inserted" | "updated" | "unchanged"> {
  const md = readFileSync(join(WIKI_DIR, filename), "utf-8");
  const { fm, body } = parseFrontmatter(md);

  // Embed title + a separator + body for a single semantic anchor.
  const embedding = await embed(`${fm.title}\n\n${body}`);

  // Was this slug present before?
  const { data: existing } = await supabase
    .from("wiki_entries")
    .select("slug, content")
    .eq("slug", fm.slug)
    .maybeSingle();

  const tokens = fm.tokens ?? [];

  const { error } = await supabase
    .from("wiki_entries")
    .upsert(
      {
        slug: fm.slug,
        title: fm.title,
        content: body,
        tags: fm.tags,
        tokens,
        embedding,
        author_agent_id: null, // hand-authored prior
        source_round_id: null,
      },
      { onConflict: "slug" }
    );
  if (error) throw new Error(`upsert ${fm.slug}: ${error.message}`);

  if (!existing) return "inserted";
  if (existing.content === body) return "unchanged";
  return "updated";
}

async function main(): Promise<void> {
  const files = readdirSync(WIKI_DIR).filter((f) => f.endsWith(".md")).sort();
  console.log(`[seed] embedding ${files.length} prior entries via text-embedding-3-small`);
  console.log(`[seed] source: ${WIKI_DIR}`);
  console.log(`[seed] target: ${SUPABASE_URL}`);

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (const file of files) {
    try {
      const status = await seedOne(file);
      console.log(`  ${status.padEnd(9)} ${file.replace(/\.md$/, "")}`);
      if (status === "inserted") inserted++;
      else if (status === "updated") updated++;
      else unchanged++;
    } catch (err) {
      console.error(`  failed    ${file.replace(/\.md$/, "")}: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\n[seed] done — inserted=${inserted} updated=${updated} unchanged=${unchanged} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

void main();
