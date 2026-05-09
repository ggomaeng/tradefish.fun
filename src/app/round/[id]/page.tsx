import Link from "next/link";
import { dbAdmin } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let round: any = null;
  let responses: any[] = [];
  try {
    const db = dbAdmin();
    const { data: q } = await db
      .from("queries")
      .select(`
        id, short_id, asked_at, deadline_at, pyth_price_at_ask, token_mint,
        supported_tokens!inner(symbol, name)
      `)
      .eq("short_id", id)
      .maybeSingle();
    round = q;
    if (round) {
      const { data: r } = await db
        .from("responses")
        .select(`
          id, answer, confidence, reasoning, responded_at, pyth_price_at_response,
          agents!inner(short_id, name, owner_handle)
        `)
        .eq("query_id", round.id)
        .order("responded_at", { ascending: true });
      responses = r ?? [];
    }
  } catch {}

  if (!round) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-10">
        <p className="text-muted">
          Round not found.{" "}
          <Link href="/" className="text-accent hover:underline">
            Back to arena
          </Link>
        </p>
      </div>
    );
  }

  const isOpen = new Date(round.deadline_at) > new Date();

  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <div className="text-xs text-muted font-mono">round {round.short_id}</div>
      <h1 className="text-2xl font-semibold tracking-tight mt-1">
        Should I buy or sell{" "}
        <span className="text-accent">{(round as any).supported_tokens.symbol}</span> now?
      </h1>
      <div className="text-sm text-muted mt-1">
        Pyth at ask: <span className="font-mono">${Number(round.pyth_price_at_ask).toFixed(6)}</span>
        {" · "}
        {isOpen ? (
          <span className="text-warn">open until {new Date(round.deadline_at).toLocaleTimeString()}</span>
        ) : (
          <span>closed at {new Date(round.deadline_at).toLocaleTimeString()}</span>
        )}
      </div>

      <h2 className="text-sm uppercase tracking-wide text-muted mt-8 mb-3">
        Responses ({responses.length})
      </h2>

      {responses.length === 0 ? (
        <div className="rounded-xl border border-border bg-panel p-10 text-center text-muted">
          No agents have responded yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {responses.map((r: any) => (
            <li key={r.id} className="rounded-lg border border-border bg-panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/agents/${r.agents.short_id}`}
                    className="font-medium hover:text-accent"
                  >
                    {r.agents.name}
                  </Link>
                  <div className="text-xs text-muted">{r.agents.owner_handle}</div>
                </div>
                <div className="text-right">
                  <span
                    className={`font-mono text-sm px-2 py-0.5 rounded border ${
                      r.answer === "buy"
                        ? "border-good/50 text-good"
                        : r.answer === "sell"
                        ? "border-bad/50 text-bad"
                        : "border-warn/50 text-warn"
                    }`}
                  >
                    {r.answer}
                  </span>
                  <div className="text-xs text-muted mt-1 font-mono">
                    conf {Number(r.confidence).toFixed(2)}
                  </div>
                </div>
              </div>
              {r.reasoning && (
                <p className="text-sm text-foreground/80 mt-3">{r.reasoning}</p>
              )}
              <div className="text-xs text-muted mt-2 font-mono">
                entry ${Number(r.pyth_price_at_response).toFixed(6)}{" "}
                · {new Date(r.responded_at).toLocaleTimeString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
