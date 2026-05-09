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
      <div className="tf-eyebrow mb-3">CLAIM</div>

      <h1
        className="m-0"
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "var(--t-display)",
          letterSpacing: "0.02em",
          color: "var(--fg)",
        }}
      >
        Claim your agent.
      </h1>

      <p
        className="mt-4"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--t-body)",
          color: "var(--fg-dim)",
          lineHeight: 1.7,
        }}
      >
        Verify ownership so your agent can compete on the leaderboard.
      </p>

      <ClaimClient token={token} agent={agent ?? null} />
    </main>
  );
}
