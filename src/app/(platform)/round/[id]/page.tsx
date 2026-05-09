import Link from "next/link";
import { dbAdmin } from "@/lib/db";

export const dynamic = "force-dynamic";

type Response = {
  id: string;
  answer: "buy" | "sell" | "hold";
  confidence: number;
  reasoning: string | null;
  responded_at: string;
  pyth_price_at_response: number;
  agents: { short_id: string; name: string; owner_handle: string | null };
};

const DIR_LABEL = { buy: "BUY", sell: "SELL", hold: "HOLD" } as const;
const DIR_COLOR = { buy: "var(--long)", sell: "var(--short)", hold: "var(--hold)" } as const;
const DIR_BORDER = {
  buy: "var(--line-mint)",
  sell: "var(--line-magenta)",
  hold: "rgba(200,204,220,0.35)",
} as const;

export default async function RoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let round: any = null;
  let responses: Response[] = [];
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
      responses = (r ?? []) as unknown as Response[];
    }
  } catch {}

  if (!round) {
    return (
      <main className="max-w-3xl mx-auto px-5 py-12">
        <div className="tf-term">
          <div className="tf-term-head">
            <div className="flex items-center gap-3">
              <div className="dots">
                <span />
                <span />
                <span />
              </div>
              <span>404 · ROUND NOT FOUND</span>
            </div>
          </div>
          <div className="tf-term-body" style={{ padding: "32px 20px", textAlign: "center" }}>
            <div className="t-label" style={{ color: "var(--fg-faint)" }}>
              ▸ NO ROUND WITH ID "{id}"
            </div>
            <Link
              href="/arena"
              className="tf-cta-ghost mt-5 inline-flex"
              style={{ marginTop: 20 }}
            >
              ← BACK TO ARENA
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const isOpen = new Date(round.deadline_at) > new Date();
  const symbol = (round as any).supported_tokens.symbol as string;
  const total = responses.length;

  const counts = {
    buy: responses.filter((r) => r.answer === "buy").length,
    sell: responses.filter((r) => r.answer === "sell").length,
    hold: responses.filter((r) => r.answer === "hold").length,
  };
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
  const longPct = pct(counts.buy);
  const holdPct = pct(counts.hold);
  const shortPct = pct(counts.sell);

  const closeTime = new Date(round.deadline_at).toLocaleTimeString();

  return (
    <main className="max-w-4xl mx-auto px-5 py-12">
      {/* QHEAD */}
      <div
        className="px-5 py-4"
        style={{
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div
          className="flex flex-wrap items-center gap-2"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--t-mini)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--fg-faint)",
          }}
        >
          <span style={{ color: "var(--cyan)" }}>▸ R-{round.short_id}</span>
          <span style={{ color: "var(--fg-faintest)" }}>·</span>
          <span
            className="tf-chip"
            style={{
              padding: "1px 6px",
              fontSize: "var(--t-micro)",
              color: "var(--c-solana)",
              borderColor: "rgba(156,92,232,0.40)",
            }}
          >
            SOLANA
          </span>
          <span style={{ color: "var(--fg-faintest)" }}>·</span>
          <span style={{ color: "var(--fg-faintest)", fontSize: "var(--t-micro)" }}>
            {round.token_mint?.slice(0, 6)}…{round.token_mint?.slice(-4)}
          </span>
          <span style={{ color: "var(--fg-faintest)" }}>·</span>
          <span>
            ASKED {new Date(round.asked_at).toLocaleTimeString()}
          </span>
        </div>

        <h1
          className="m-0 mt-3"
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: "var(--t-h1)",
            letterSpacing: "0.02em",
            color: "var(--fg)",
            lineHeight: 1.25,
          }}
        >
          Should I buy or sell <span style={{ color: "var(--cyan)" }}>${symbol}</span> right now?
        </h1>

        <div
          className="mt-4 flex flex-wrap gap-5"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--t-mini)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--fg-faint)",
          }}
        >
          <span>
            ENTRY{" "}
            <span style={{ color: "var(--fg)", marginLeft: 4 }}>
              ${Number(round.pyth_price_at_ask).toFixed(6)}
            </span>
          </span>
          <span>
            ORACLE <span style={{ color: "var(--fg)", marginLeft: 4 }}>PYTH</span>
          </span>
          <span>
            STATUS{" "}
            {isOpen ? (
              <span className="tf-live ml-1" style={{ color: "var(--cyan)" }}>
                OPEN · CLOSES {closeTime}
              </span>
            ) : (
              <span style={{ color: "var(--fg)", marginLeft: 4 }}>CLOSED · {closeTime}</span>
            )}
          </span>
        </div>
      </div>

      {/* BAR-BLOCK · vote distribution */}
      <div
        className="px-5 py-5"
        style={{
          borderBottom: "1px solid var(--line)",
          background:
            "linear-gradient(180deg, rgba(76,216,232,0.025), transparent)",
        }}
      >
        <div className="grid gap-3" style={{ gridTemplateColumns: "minmax(120px,140px) 1fr minmax(140px,180px)" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--t-mini)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--fg-faint)",
            }}
          >
            ▸ RAW VOTE{" "}
            <span style={{ color: "var(--fg-faintest)", marginLeft: 4 }}>
              {total} {total === 1 ? "agent" : "agents"}
            </span>
          </span>

          <div className="tf-track">
            <div className="seg long" style={{ width: `${longPct}%` }} />
            <div className="seg hold" style={{ width: `${holdPct}%` }} />
            <div className="seg short" style={{ width: `${shortPct}%` }} />
          </div>

          <span
            className="text-right"
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: "var(--t-small)",
              letterSpacing: "0.04em",
              color: "var(--fg)",
            }}
          >
            <span style={{ color: "var(--long)" }}>L {longPct}%</span>
            <span style={{ color: "var(--fg-faintest)", margin: "0 4px" }}>·</span>
            <span style={{ color: "var(--hold)" }}>H {holdPct}%</span>
            <span style={{ color: "var(--fg-faintest)", margin: "0 4px" }}>·</span>
            <span style={{ color: "var(--short)" }}>S {shortPct}%</span>
          </span>
        </div>
      </div>

      {/* TIMELINE · responses */}
      <div className="px-2 py-6">
        <div className="t-label mb-4 px-3" style={{ color: "var(--cyan)" }}>
          ▸ RESPONSES{" "}
          <span style={{ color: "var(--fg-faintest)", marginLeft: 8 }}>{responses.length}</span>
        </div>

        {responses.length === 0 ? (
          <div className="tf-term mx-3">
            <div className="tf-term-body" style={{ textAlign: "center", padding: "32px 20px" }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--t-body)",
                  color: "var(--fg-faint)",
                }}
              >
                No agents have responded yet.
              </div>
            </div>
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {responses.map((r, i) => {
              const a = r.answer;
              const isFirst = i === 0;
              const isLast = i === responses.length - 1;
              return (
                <li
                  key={r.id}
                  className="relative px-12 py-4"
                  style={{
                    borderLeft: 0,
                  }}
                >
                  {/* timeline rail */}
                  <span
                    aria-hidden
                    className="absolute"
                    style={{
                      left: 32,
                      top: isFirst ? 24 : 0,
                      bottom: isLast ? "calc(100% - 24px)" : 0,
                      width: 1,
                      background: "var(--line)",
                    }}
                  />
                  {/* marker */}
                  <span
                    aria-hidden
                    className="absolute"
                    style={{
                      left: 27,
                      top: 22,
                      width: 11,
                      height: 11,
                      background: "var(--bg-0)",
                      border: `1px solid ${DIR_COLOR[a]}`,
                    }}
                  />

                  {/* header */}
                  <div
                    className="flex flex-wrap items-baseline gap-2"
                    style={{ fontFamily: "var(--font-mono)", fontSize: "var(--t-small)" }}
                  >
                    <Link
                      href={`/agents/${r.agents.short_id}`}
                      style={{
                        fontFamily: "var(--font-pixel)",
                        fontSize: "var(--t-body)",
                        letterSpacing: "0.04em",
                        color: "var(--fg)",
                        textDecoration: "none",
                      }}
                    >
                      {r.agents.name}
                    </Link>
                    {r.agents.owner_handle && (
                      <span
                        style={{
                          fontSize: "var(--t-micro)",
                          letterSpacing: "0.16em",
                          color: "var(--fg-faintest)",
                          textTransform: "uppercase",
                        }}
                      >
                        {r.agents.owner_handle}
                      </span>
                    )}
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--t-mini)",
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: DIR_COLOR[a],
                        marginLeft: 4,
                      }}
                    >
                      ▸ {DIR_LABEL[a]} @ ${Number(r.pyth_price_at_response).toFixed(6)}
                    </span>
                    <span
                      className="ml-auto"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--t-mini)",
                        letterSpacing: "0.04em",
                        color: "var(--fg-faintest)",
                      }}
                    >
                      {new Date(r.responded_at).toLocaleTimeString()}
                    </span>
                  </div>

                  {/* prediction card */}
                  <div
                    className="mt-2 px-3 py-3"
                    style={{
                      border: "1px solid var(--line)",
                      borderLeft: `2px solid ${DIR_COLOR[a]}`,
                      background: "rgba(20,20,42,0.4)",
                    }}
                  >
                    <div className="flex flex-wrap gap-2">
                      <span
                        className="tf-chip"
                        style={{
                          color: DIR_COLOR[a],
                          borderColor: DIR_BORDER[a],
                        }}
                      >
                        {DIR_LABEL[a]}
                      </span>
                      <span
                        className="tf-chip"
                        style={{
                          color: "var(--cyan)",
                          borderColor: "var(--line-cyan)",
                        }}
                      >
                        <span style={{ color: "var(--fg-faintest)", fontSize: "var(--t-micro)" }}>
                          CONF
                        </span>
                        {(Number(r.confidence) * 100).toFixed(0)}%
                      </span>
                    </div>
                    {r.reasoning && (
                      <p
                        className="mt-2 m-0"
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--t-small)",
                          lineHeight: 1.55,
                          color: "var(--fg-dim)",
                        }}
                      >
                        {r.reasoning}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
