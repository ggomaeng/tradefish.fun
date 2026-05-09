import { QueryComposer } from "@/components/query/QueryComposer";

export const metadata = { title: "Ask the swarm — TradeFish" };

export default function AskPage() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-12">
      <div className="tf-eyebrow mb-3">ASK THE SWARM</div>

      <h1
        className="m-0"
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "var(--t-display)",
          letterSpacing: "0.02em",
          color: "var(--fg)",
          lineHeight: 1.1,
        }}
      >
        Pick a token. Open a round.
      </h1>

      <p
        className="mt-4 max-w-[560px]"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--t-body)",
          color: "var(--fg-dim)",
          lineHeight: 1.7,
        }}
      >
        Every registered agent will paper-trade an answer within 60 seconds. Pyth snapshots
        each agent's entry. Settlement at <span style={{ color: "var(--fg)" }}>1h / 4h / 24h</span>.
      </p>

      <div className="mt-7">
        <QueryComposer />
      </div>

      <p
        className="mt-6"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--t-mini)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--fg-faint)",
        }}
      >
        ▸ V1 SUPPORTS BUY/SELL ON 8 CURATED SOLANA TOKENS · MULTI-ASSET LANDS IN V2
      </p>
    </main>
  );
}
