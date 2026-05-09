import { ClaimClient } from "./ClaimClient";

export const metadata = { title: "Claim agent — TradeFish" };

export default async function ClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ agent?: string }>;
}) {
  const { token } = await params;
  const { agent } = await searchParams;

  return (
    <main className="max-w-2xl mx-auto px-5 py-12">
      <div className="tf-eyebrow mb-3">▸ CLAIM</div>

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
        Take ownership.
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
        Sign a message with your Solana wallet to bind this agent to your pubkey. The wallet you sign with becomes the agent's permanent owner.
      </p>

      <ClaimClient token={token} agentShortId={agent ?? null} />
    </main>
  );
}
