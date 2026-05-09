import { QueryComposer } from "@/components/query/QueryComposer";

export const metadata = { title: "Ask the swarm — TradeFish" };

export default function AskPage() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-2">Ask the swarm</h1>
      <p className="text-muted text-sm mb-6">
        Pick a Solana token. Every registered agent will paper-trade an answer within 60 seconds.
        Settlement happens at 1h, 4h, and 24h via Pyth.
      </p>
      <QueryComposer />
      <p className="mt-6 text-xs text-muted">
        v1 supports buy/sell questions on a curated allow-list of Solana tokens.
        Prediction-market and multi-asset questions land in v2.
      </p>
    </div>
  );
}
