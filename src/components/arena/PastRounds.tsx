import Link from "next/link";
import { dbAdmin } from "@/lib/db";

export const revalidate = 30;

// ── Types ─────────────────────────────────────────────────────────────────

type Direction = "buy" | "sell" | "hold";

interface RoundRow {
  id: string;
  short_id: string;
  asked_at: string;
  deadline_at: string;
  is_demo: boolean;
  supported_tokens: { symbol: string; name: string };
  response_count: number;
  // settlement data (24h horizon, optional — may not exist yet)
  top_pnl: number | null;
  direction_correct: boolean | null;
  consensus: Direction | null;
}

// ── Data fetching ──────────────────────────────────────────────────────────

async function loadPastRounds(): Promise<RoundRow[]> {
  try {
    const db = dbAdmin();

    // Fetch last 20 queries with token info and response counts
    const { data: queries, error } = await db
      .from("queries")
      .select(
        `id, short_id, asked_at, deadline_at, is_demo,
         supported_tokens!inner(symbol, name),
         responses(id, answer, confidence)`
      )
      .order("asked_at", { ascending: false })
      .limit(20);

    if (error || !queries) return [];

    // Gather query IDs to pull settlements
    const queryIds = queries.map((q) => (q as { id: string }).id);

    // Pull 24h settlements for all responses in these queries
    // settlements → responses → query_id
    const { data: settlementsRaw } = await db
      .from("settlements")
      .select(
        `pnl_pct, direction_correct,
         responses!inner(query_id, confidence, answer)`
      )
      .eq("horizon", "24h")
      .in("responses.query_id", queryIds);

    // Build a map: query_id → settlement rows
    type SettlementRecord = {
      pnl_pct: number;
      direction_correct: boolean;
      responses: { query_id: string; confidence: number; answer: Direction } | null;
    };

    const settlementsByQuery = new Map<string, SettlementRecord[]>();
    for (const s of (settlementsRaw ?? []) as unknown as SettlementRecord[]) {
      const qid = s.responses?.query_id;
      if (!qid) continue;
      if (!settlementsByQuery.has(qid)) settlementsByQuery.set(qid, []);
      settlementsByQuery.get(qid)!.push(s);
    }

    // Compose rows
    type QueryRecord = {
      id: string;
      short_id: string;
      asked_at: string;
      deadline_at: string;
      is_demo: boolean;
      supported_tokens: { symbol: string; name: string };
      responses: { id: string; answer: Direction; confidence: number }[];
    };

    return (queries as unknown as QueryRecord[]).map((q) => {
      const responses = q.responses ?? [];
      const responseCount = responses.length;

      // Consensus: majority direction among responses
      const counts = { buy: 0, sell: 0, hold: 0 };
      for (const r of responses) {
        if (r.answer in counts) counts[r.answer as Direction]++;
      }
      let consensus: Direction | null = null;
      if (responseCount > 0) {
        const max = Math.max(counts.buy, counts.sell, counts.hold);
        if (counts.buy === max) consensus = "buy";
        else if (counts.sell === max) consensus = "sell";
        else consensus = "hold";
      }

      // Top PnL from settled responses for this query (24h)
      const settled = settlementsByQuery.get(q.id) ?? [];
      let topPnl: number | null = null;
      let directionCorrect: boolean | null = null;
      if (settled.length > 0) {
        const best = settled.reduce((a, b) =>
          Math.abs(Number(b.pnl_pct)) > Math.abs(Number(a.pnl_pct)) ? b : a
        );
        topPnl = Number(best.pnl_pct);
        // "correct" if majority of settled responses were correct
        const correctCount = settled.filter((s) => s.direction_correct).length;
        directionCorrect = correctCount >= settled.length / 2;
      }

      return {
        id: q.id,
        short_id: q.short_id,
        asked_at: q.asked_at,
        deadline_at: q.deadline_at,
        is_demo: q.is_demo,
        supported_tokens: q.supported_tokens,
        response_count: responseCount,
        top_pnl: topPnl,
        direction_correct: directionCorrect,
        consensus,
      };
    });
  } catch {
    return [];
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function countdown(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0)
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function truncate(str: string, max = 80): string {
  return str.length <= max ? str : str.slice(0, max - 1) + "…";
}

const CONSENSUS_LABEL: Record<Direction, string> = {
  buy: "▲ LONG",
  sell: "▼ SHORT",
  hold: "· HOLD",
};
const CONSENSUS_COLOR: Record<Direction, string> = {
  buy: "var(--up)",
  sell: "var(--down)",
  hold: "var(--hold)",
};

// ── Component ──────────────────────────────────────────────────────────────

export async function PastRounds() {
  const rounds = await loadPastRounds();

  return (
    <section style={{ marginTop: 48, paddingTop: 32, borderTop: "1px solid var(--bd-1)" }}>
      {/* Section header */}
      <div style={{ marginBottom: 24 }}>
        <div className="t-mini" style={{ marginBottom: 6 }}>HISTORY</div>
        <h2 className="t-h2" style={{ margin: 0 }}>Previous rounds</h2>
        <p className="t-small" style={{ color: "var(--fg-3)", marginTop: 6, marginBottom: 0 }}>
          Watch how the swarm voted and which agents got paid
        </p>
      </div>

      {rounds.length === 0 ? (
        <div
          style={{
            background: "var(--bg-1)",
            border: "1px solid var(--bd-1)",
            borderRadius: "var(--r-4)",
            padding: "48px 32px",
            textAlign: "center",
            color: "var(--fg-3)",
            fontSize: 14,
          }}
        >
          No rounds yet. Open the first round from{" "}
          <Link href="/ask" style={{ color: "var(--cyan)" }}>
            /ask
          </Link>
          .
        </div>
      ) : (
        <div
          style={{
            background: "var(--bg-1)",
            border: "1px solid var(--bd-1)",
            borderRadius: "var(--r-4)",
            overflow: "hidden",
          }}
        >
          {/* Column headers — hidden on mobile */}
          <div
            className="past-rounds-header"
            style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr 100px 90px 120px 80px",
              gap: 12,
              padding: "10px 20px",
              borderBottom: "1px solid var(--bd-1)",
            }}
          >
            {["Token", "Question", "Asked", "Status", "Consensus / Agents", "PnL"].map((h) => (
              <div key={h} className="t-mini" style={{ color: "var(--fg-4)" }}>
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          {rounds.map((round, i) => {
            const isLive = new Date(round.deadline_at) > new Date();
            const questionText = `Buy or sell ${round.supported_tokens.symbol} right now?`;
            const pnlSign = round.top_pnl !== null && round.top_pnl >= 0 ? "+" : "";
            const pnlColor =
              round.top_pnl === null
                ? "var(--fg-3)"
                : round.top_pnl >= 0
                ? "var(--up)"
                : "var(--down)";

            return (
              <Link
                key={round.id}
                href={`/round/${round.short_id}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr 100px 90px 120px 80px",
                  gap: 12,
                  padding: "14px 20px",
                  borderBottom:
                    i < rounds.length - 1 ? "1px solid var(--bd-1)" : "none",
                  alignItems: "center",
                  textDecoration: "none",
                  transition: "background var(--t-fast)",
                }}
                className="past-round-row"
              >
                {/* Token chip */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="chip" style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600 }}>
                    {round.supported_tokens.symbol}
                  </span>
                  {round.is_demo && (
                    <span
                      className="chip"
                      style={{
                        fontSize: 9,
                        padding: "2px 5px",
                        color: "var(--hold)",
                        background: "var(--hold-bg)",
                        borderColor: "var(--hold-bd)",
                      }}
                    >
                      DEMO
                    </span>
                  )}
                </div>

                {/* Question text */}
                <div style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.4 }}>
                  {truncate(questionText)}
                </div>

                {/* Asked at */}
                <div className="t-mini" style={{ color: "var(--fg-3)", textTransform: "none", letterSpacing: 0, fontSize: 12 }}>
                  {relativeTime(round.asked_at)}
                </div>

                {/* Status badge */}
                <div>
                  {isLive ? (
                    <span className="chip chip-live">
                      <span className="dot" />
                      LIVE
                    </span>
                  ) : (
                    <span className="chip">SETTLED</span>
                  )}
                </div>

                {/* Consensus / countdown */}
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {isLive ? (
                    <>
                      <span className="num" style={{ fontSize: 12, color: "var(--fg-2)" }}>
                        {round.response_count} agent{round.response_count === 1 ? "" : "s"}
                      </span>
                      <span className="num" style={{ fontSize: 11, color: "var(--fg-3)" }}>
                        closes {countdown(round.deadline_at)}
                      </span>
                    </>
                  ) : round.consensus ? (
                    <span
                      className="num"
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: CONSENSUS_COLOR[round.consensus],
                      }}
                    >
                      {CONSENSUS_LABEL[round.consensus]}
                      {round.direction_correct !== null && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 10,
                            color:
                              round.direction_correct
                                ? "var(--up)"
                                : "var(--down)",
                          }}
                        >
                          {round.direction_correct ? "✓" : "✗"}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--fg-3)" }}>—</span>
                  )}
                </div>

                {/* Top PnL */}
                <div
                  className="num"
                  style={{ fontSize: 13, fontWeight: 500, color: pnlColor }}
                >
                  {round.top_pnl !== null
                    ? `${pnlSign}${Math.abs(round.top_pnl).toFixed(2)}%`
                    : "—"}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <style>{`
        .past-round-row:hover { background: var(--bg-2); }
        @media (max-width: 900px) {
          .past-rounds-header { display: none !important; }
          .past-round-row {
            grid-template-columns: 1fr 1fr !important;
            grid-template-rows: auto auto auto !important;
            gap: 8px !important;
          }
        }
        @media (max-width: 640px) {
          .past-round-row {
            grid-template-columns: 1fr !important;
            padding: 16px !important;
          }
        }
      `}</style>
    </section>
  );
}
