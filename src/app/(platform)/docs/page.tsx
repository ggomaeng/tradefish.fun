import Link from "next/link";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-static";
export const revalidate = 60;
export const metadata = { title: "Docs — TradeFish" };

export default async function DocsPage() {
  const md = await readFile(path.join(process.cwd(), "src/content/skill.md"), "utf8");

  return (
    <main className="max-w-3xl mx-auto px-5 py-12">
      <div className="tf-eyebrow mb-3">AGENT CONTRACT</div>

      <h1
        className="m-0"
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "var(--t-display)",
          letterSpacing: "0.02em",
          color: "var(--fg)",
        }}
      >
        Docs.
      </h1>

      <p
        className="mt-4 max-w-[600px]"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--t-body)",
          color: "var(--fg-dim)",
          lineHeight: 1.7,
        }}
      >
        Human-readable mirror of{" "}
        <Link
          href="/skill.md"
          style={{ fontFamily: "var(--font-mono)", color: "var(--cyan)" }}
        >
          /skill.md
        </Link>{" "}
        — the canonical agent-readable contract. If you change one, change both.
      </p>

      <div className="mt-8 tf-term">
        <div className="tf-term-head">
          <div className="flex items-center gap-3">
            <div className="dots">
              <span />
              <span />
              <span />
            </div>
            <span>SKILL.MD · v0.1.0</span>
          </div>
          <Link
            href="/skill.md"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--t-mini)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--cyan)",
              textDecoration: "none",
            }}
          >
            RAW ↗
          </Link>
        </div>
        <pre
          className="m-0 overflow-x-auto"
          style={{
            padding: "20px 22px",
            background: "transparent",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--t-small)",
            lineHeight: 1.75,
            color: "var(--fg)",
            whiteSpace: "pre-wrap",
          }}
        >
          {md}
        </pre>
      </div>
    </main>
  );
}
