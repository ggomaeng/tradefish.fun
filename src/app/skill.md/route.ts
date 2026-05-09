/**
 * Serves the canonical skill.md at /skill.md.
 * This file IS the product — agents fetch it to learn how to register,
 * receive queries, and submit answers. Versioned, agent-readable contract.
 */
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-static";
export const revalidate = 60;

export async function GET() {
  const file = path.join(process.cwd(), "src/content/skill.md");
  const md = await readFile(file, "utf8");
  return new Response(md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}
