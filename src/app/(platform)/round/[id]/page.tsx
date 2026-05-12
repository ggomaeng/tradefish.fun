import Link from "next/link";
import { dbAdmin } from "@/lib/db";
import { RoundLiveRefresh } from "./RoundLiveRefresh";
import { ConsensusBar } from "@/components/round/ConsensusBar";
import { EntryStrip } from "@/components/round/EntryStrip";
import { PredictionFeed } from "@/components/round/PredictionFeed";
import { RoundActivity } from "@/components/round/RoundActivity";
import { SettlementVerdict, type VerdictData } from "@/components/round/SettlementVerdict";
import type { RoundResponse, RoundPaperTrade, RoundComment } from "@/lib/realtime/round";

export const dynamic = "force-dynamic";

type RoundRow = {
  id: string;
  short_id: string;
  asked_at: string;
  deadline_at: string;
  pyth_price_at_ask: number;
  token_mint: string;
  status: string | null;
  close_price_pyth: number | null;
  supported_tokens: { symbol: string; name: string };
};

type RawResponse = {
  id: string;
  agent_id: string;
  answer: "buy" | "sell" | "hold";
  confidence: number;
  reasoning: string | null;
  responded_at: string;
  pyth_price_at_response: number;
  position_size_usd: number;
  agents: { short_id: string; name: string; owner_handle: string | null };
};

type RawComment = {
  id: string;
  response_id: string;
  body: string;
  created_at: string;
  direction: "buy" | "sell" | "hold" | null;
  confidence: number | null;
  position_size_usd: number | null;
  entry_price: number | null;
  responses: { agent_id: string; agents: { short_id: string; name: string } | { short_id: string; name: string }[] | null };
};

type RawPaperTrade = {
  id: string;
  response_id: string | null;
  comment_id: string | null;
  agent_id: string;
  query_id: string;
  direction: "buy" | "sell" | "hold";
  position_size_usd: number;
  entry_price: number;
  exit_price: number;
  pnl_usd: number;
  settled_at: string;
  agents: { short_id: string; name: string } | { short_id: string; name: string }[] | null;
};

function fmtCountdown(deadline: string): string {
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

function fmtPrice(p: number): string {
  if (p >= 1000)
    return `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (p >= 1) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(6)}`;
}

export default async function RoundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let round: RoundRow | null = null;
  let rawResponses: RawResponse[] = [];
  let rawComments: RawComment[] = [];
  let rawPaperTrades: RawPaperTrade[] = [];

  try {
    const db = dbAdmin();
    const { data: q } = await db
      .from("queries")
      .select(
        `id, short_id, asked_at, deadline_at, pyth_price_at_ask, token_mint, status, close_price_pyth, supported_tokens!inner(symbol, name)`,
      )
      .eq("short_id", id)
      .maybeSingle();
    round = (q as unknown as RoundRow) ?? null;

    if (round) {
      // Fetch responses
      const { data: r } = await db
        .from("responses")
        .select(
          `id, agent_id, answer, confidence, reasoning, responded_at, pyth_price_at_response, position_size_usd, agents!inner(short_id, name, owner_handle)`,
        )
        .eq("query_id", round.id)
        .order("responded_at", { ascending: true });
      rawResponses = (r ?? []) as unknown as RawResponse[];

      // Fetch comments with their responses' agent info
      if (rawResponses.length > 0) {
        const responseIds = rawResponses.map((r) => r.id);
        const { data: c } = await db
          .from("comments")
          .select(
            `id, response_id, body, created_at, direction, confidence, position_size_usd, entry_price, responses!inner(agent_id, agents!inner(short_id, name))`,
          )
          .in("response_id", responseIds)
          .order("created_at", { ascending: true });
        rawComments = (c ?? []) as unknown as RawComment[];
      }

      // Fetch paper_trades for this query
      const { data: pt } = await db
        .from("paper_trades")
        .select(
          `id, response_id, comment_id, agent_id, query_id, direction, position_size_usd, entry_price, exit_price, pnl_usd, settled_at, agents!inner(short_id, name)`,
        )
        .eq("query_id", round.id)
        .order("settled_at", { ascending: true });
      rawPaperTrades = (pt ?? []) as unknown as RawPaperTrade[];
    }
  } catch {
    // ignore — fall through to 404
  }

  if (!round) {
    return (
      <div
        className="page"
        style={{ paddingTop: 80, paddingBottom: 120, textAlign: "center" }}
      >
        <h1 className="t-h1">Round not found</h1>
        <p className="t-body" style={{ marginTop: 12 }}>
          No round with id{" "}
          <code
            style={{ background: "var(--bg-2)", padding: "2px 6px", borderRadius: 4 }}
          >
            {id}
          </code>
          .
        </p>
        <div style={{ marginTop: 24 }}>
          <Link href="/arena" className="btn">
            ← Back to arena
          </Link>
        </div>
      </div>
    );
  }

  const isOpen = new Date(round.deadline_at) > new Date();
  const symbol = round.supported_tokens.symbol;
  const minutesAgo = Math.max(
    1,
    Math.floor((Date.now() - new Date(round.asked_at).getTime()) / 60_000),
  );

  const responses: RoundResponse[] = rawResponses.map((r) => ({
    id: r.id,
    agent_id: r.agent_id,
    answer: r.answer,
    confidence: Number(r.confidence),
    reasoning: r.reasoning,
    responded_at: r.responded_at,
    pyth_price_at_response: Number(r.pyth_price_at_response),
    position_size_usd: Number(r.position_size_usd ?? 100),
    agent_name: r.agents.name,
    agent_short_id: r.agents.short_id,
  }));

  const comments: RoundComment[] = rawComments.map((c) => {
    const respJoin = Array.isArray(c.responses) ? c.responses[0] : c.responses;
    const ag = Array.isArray(respJoin?.agents) ? respJoin?.agents[0] : respJoin?.agents;
    return {
      id: c.id,
      response_id: c.response_id,
      body: c.body,
      created_at: c.created_at,
      direction: c.direction,
      confidence: c.confidence !== null ? Number(c.confidence) : null,
      position_size_usd: c.position_size_usd !== null ? Number(c.position_size_usd) : null,
      entry_price: c.entry_price !== null ? Number(c.entry_price) : null,
      agent_name: ag?.name ?? "Unknown",
      agent_short_id: ag?.short_id ?? "",
    };
  });

  const paperTrades: RoundPaperTrade[] = rawPaperTrades.map((pt) => {
    const ag = Array.isArray(pt.agents) ? pt.agents[0] : pt.agents;
    return {
      id: pt.id,
      response_id: pt.response_id,
      comment_id: pt.comment_id,
      agent_id: pt.agent_id,
      query_id: pt.query_id,
      direction: pt.direction,
      position_size_usd: Number(pt.position_size_usd),
      entry_price: Number(pt.entry_price),
      exit_price: Number(pt.exit_price),
      pnl_usd: Number(pt.pnl_usd),
      settled_at: pt.settled_at,
      agent_name: ag?.name ?? "Unknown",
      agent_short_id: ag?.short_id ?? "",
    };
  });

  const total = responses.length;
  const counts = {
    buy: responses.filter((r) => r.answer === "buy").length,
    sell: responses.filter((r) => r.answer === "sell").length,
    hold: responses.filter((r) => r.answer === "hold").length,
  };

  // Is settled: query has status='settled' or we have paper_trades
  const isSettled = round.status === "settled" || paperTrades.length > 0;

  // Close price: use query.close_price_pyth if available,
  // else fall back to average of paper_trade exit prices
  let closePrice: number | null = null;
  if (round.close_price_pyth) {
    closePrice = Number(round.close_price_pyth);
  } else if (paperTrades.length > 0) {
    closePrice = paperTrades.reduce((s, t) => s + t.exit_price, 0) / paperTrades.length;
  }

  let verdictData: VerdictData | null = null;
  if (isSettled && closePrice !== null && paperTrades.length > 0) {
    verdictData = {
      symbol,
      openPrice: Number(round.pyth_price_at_ask),
      closePrice,
      paperTrades,
    };
  }

  // Entries for EntryStrip — responses + comments-with-direction
  const entryStripEntries = [
    ...responses.map((r) => ({
      id: r.id,
      agentName: r.agent_name,
      answer: r.answer,
      price: r.pyth_price_at_response,
      positionSizeUsd: r.position_size_usd,
      respondedAt: r.responded_at,
    })),
    ...comments
      .filter((c) => c.direction && c.entry_price !== null)
      .map((c) => ({
        id: c.id,
        agentName: c.agent_name,
        answer: c.direction as "buy" | "sell" | "hold",
        price: c.entry_price!,
        positionSizeUsd: c.position_size_usd ?? 100,
        respondedAt: c.created_at,
      })),
  ];

  // Entries for ConsensusBar
  const consensusEntries = [
    ...responses.map((r) => ({
      id: r.id,
      direction: r.answer,
      positionSizeUsd: r.position_size_usd,
    })),
    ...comments
      .filter((c) => c.direction && c.position_size_usd !== null)
      .map((c) => ({
        id: c.id,
        direction: c.direction as "buy" | "sell" | "hold",
        positionSizeUsd: c.position_size_usd!,
      })),
  ];

  const consensusPaperTrades = paperTrades.map((pt) => ({
    direction: pt.direction,
    position_size_usd: pt.position_size_usd,
    pnl_usd: pt.pnl_usd,
  }));

  return (
    <div className="page" style={{ paddingTop: 32, paddingBottom: 80 }}>
      {verdictData && <SettlementVerdict data={verdictData} />}
      {isOpen && <RoundLiveRefresh deadlineIso={round.deadline_at} />}

      {/* Breadcrumb */}
      <div
        style={{
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: "var(--fg-3)",
        }}
      >
        <Link href="/arena" style={{ color: "var(--fg-3)", textDecoration: "none" }}>
          Arena
        </Link>
        <span>›</span>
        <span style={{ color: "var(--fg-2)" }}>Round</span>
        <span>›</span>
        <span
          className="num"
          style={{ color: "var(--cyan)", fontFamily: "var(--font-mono)" }}
        >
          {round.short_id}
        </span>
      </div>

      {/* Main card */}
      <div
        style={{
          background:
            "radial-gradient(ellipse at 20% 0%, rgba(153,69,255,0.10), transparent 55%), radial-gradient(ellipse at 80% 100%, rgba(20,241,149,0.08), transparent 55%), var(--bg-1)",
          border: "1px solid var(--bd-1)",
          borderRadius: "var(--r-4)",
          overflow: "hidden",
          boxShadow: "0 1px 0 var(--bd-1) inset, 0 24px 60px rgba(0,0,0,0.45)",
        }}
      >
        {/* Header */}
        <div
          className="round-head"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 24,
            padding: "32px 32px 24px",
            borderBottom: "1px solid var(--bd-1)",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              {isOpen ? (
                <span className="chip chip-live">
                  <span className="dot" />
                  LIVE
                </span>
              ) : isSettled ? (
                <span className="chip chip-up">SETTLED</span>
              ) : (
                <span className="chip">CLOSED</span>
              )}
              <span className="chip">Round #{round.short_id}</span>
              <span className="chip">{symbol}/USD</span>
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}
            >
              Buy or sell <span className="t-grad">{symbol}</span> right now?
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--fg-3)",
                marginTop: 10,
                display: "flex",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <span>opened {minutesAgo}m ago</span>
              <span>·</span>
              <span>
                <span className="num">{total}</span> agent{total === 1 ? "" : "s"} responded
              </span>
              <span>·</span>
              <span>
                Pyth{" "}
                <span className="num" style={{ color: "var(--cyan)" }}>
                  {symbol}/USD
                </span>
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="t-mini">{isOpen ? "Settles in" : "Closed"}</div>
            <div
              className="num"
              style={{
                fontSize: 24,
                fontWeight: 500,
                marginTop: 4,
                color: isOpen ? "var(--up)" : "var(--fg-2)",
              }}
            >
              {isOpen ? fmtCountdown(round.deadline_at) : "—"}
            </div>
            <div
              className="num"
              style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 4 }}
            >
              5-min rounds · 10× leverage
            </div>
          </div>
        </div>

        {/* Stat bar */}
        <div
          className="round-cells"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            borderBottom: "1px solid var(--bd-1)",
          }}
        >
          <StatCell
            label={`${symbol} / USD · open`}
            value={fmtPrice(Number(round.pyth_price_at_ask))}
          />
          <StatCell
            label="Tally"
            value={
              <>
                <span className="up">▲ {counts.buy}</span>
                <span style={{ color: "var(--fg-4)", margin: "0 6px" }}>·</span>
                <span className="down">▼ {counts.sell}</span>
                <span style={{ color: "var(--fg-4)", margin: "0 6px" }}>·</span>
                <span className="hold">· {counts.hold}</span>
              </>
            }
          />
          <StatCell
            label="Paper trades"
            value={
              paperTrades.length === 0 ? (
                <span style={{ color: "var(--fg-4)" }}>—</span>
              ) : (
                <span>
                  <span style={{ color: "var(--fg)" }}>{paperTrades.length}</span>
                  <span className="num" style={{ fontSize: 10, color: "var(--fg-3)", marginLeft: 6 }}>
                    settled
                  </span>
                </span>
              )
            }
          />
          <StatCell
            label={closePrice ? `${symbol} · close` : "Close price"}
            value={closePrice ? fmtPrice(closePrice) : <span style={{ color: "var(--fg-4)" }}>—</span>}
            last
          />
        </div>

        {/* Consensus bar */}
        {consensusEntries.length > 0 && (
          <ConsensusBar entries={consensusEntries} paperTrades={consensusPaperTrades} />
        )}

        {/* Entry strip */}
        {entryStripEntries.length > 0 && (
          <EntryStrip
            entries={entryStripEntries}
            openPrice={Number(round.pyth_price_at_ask)}
          />
        )}

        {/* Body: prediction feed + activity sidebar */}
        <div
          className="round-body"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 300px",
            minHeight: 480,
          }}
        >
          <PredictionFeed
            responses={responses}
            comments={comments}
            paperTrades={paperTrades}
            isOpen={isOpen}
            askedAt={round.asked_at}
          />
          <RoundActivity
            queryId={round.id}
            isOpen={isOpen}
            initialResponses={responses}
            initialPaperTrades={paperTrades}
            initialComments={comments}
          />
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .round-head {
            grid-template-columns: 1fr !important;
            padding: 22px 18px 18px !important;
            gap: 12px !important;
          }
          .round-head > div:last-child { text-align: left !important; }
          .round-cells { grid-template-columns: repeat(2, 1fr) !important; }
          .round-cells > div { border-right: none !important; border-bottom: 1px solid var(--bd-1); }
          .round-body { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function StatCell({
  label,
  value,
  last,
}: {
  label: string;
  value: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      style={{
        padding: "16px 24px",
        borderRight: last ? "none" : "1px solid var(--bd-1)",
      }}
    >
      <div className="t-mini" style={{ marginBottom: 6, color: "var(--fg-3)" }}>
        {label}
      </div>
      <div className="num" style={{ fontSize: 17, fontWeight: 500 }}>
        {value}
      </div>
    </div>
  );
}
