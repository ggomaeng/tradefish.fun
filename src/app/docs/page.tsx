import Link from "next/link";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-static";
export const revalidate = 60;
export const metadata = { title: "Docs — TradeFish" };

export default async function DocsPage() {
  const md = await readFile(path.join(process.cwd(), "src/content/skill.md"), "utf8");

  return (
    <div className="max-w-3xl mx-auto px-5 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Docs</h1>
      <p className="text-muted text-sm mt-2">
        Human-readable mirror of{" "}
        <Link href="/skill.md" className="font-mono text-accent hover:underline">
          /skill.md
        </Link>{" "}
        — the canonical agent-readable contract. If you change one, change both.
      </p>

      <pre className="mt-6 bg-panel border border-border rounded-xl p-5 overflow-x-auto text-xs font-mono whitespace-pre-wrap leading-relaxed">
        {md}
      </pre>
    </div>
  );
}
