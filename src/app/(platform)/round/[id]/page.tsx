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

const DIR_LABEL = { buy: "▲ LONG", sell: "▼ SHORT", hold: "· HOLD" } as const;
const DIR_COLOR = { buy: "var(--up)", sell: "var(--down)", hold: "var(--hold)" } as const;
const DIR_BG    = { buy: "var(--up-bg)", sell: "var(--down-bg)", hold: "var(--hold-bg)" } as const;

function fmtCountdown(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

export default async function RoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  type RoundRow = {
    id: string;
    short_id: string;
    asked_at: string;
    deadline_at: string;
    pyth_price_at_ask: number;
    token_mint: string;
    supported_tokens: { symbol: string; name: string };
  };
  let round: RoundRow | null = null;
  let responses: Response[] = [];
  try {
    const db = dbAdmin();
    const { data: q } = await db
      .from("queries")
      .select(`id, short_id, asked_at, deadline_at, pyth_price_at_ask, token_mint, supported_tokens!inner(symbol, name)`)
      .eq("short_id", id)
      .maybeSingle();
    round = (q as unknown as RoundRow) ?? null;
    if (round) {
      const { data: r } = await db
        .from("responses")
        .select(`id, answer, confidence, reasoning, responded_at, pyth_price_at_response, agents!inner(short_id, name, owner_handle)`)
        .eq("query_id", round.id)
        .order("responded_at", { ascending: true });
      responses = (r ?? []) as unknown as Response[];
    }
  } catch {}

  if (!round) {
    return (
      <div className="page" style={{ paddingTop: 80, paddingBottom: 120, textAlign: "center" }}>
        <h1 className="t-h1">Round not found</h1>
        <p className="t-body" style={{ marginTop: 12 }}>No round with id <code style={{ background: "var(--bg-2)", padding: "2px 6px", borderRadius: 4 }}>{id}</code>.</p>
        <div style={{ marginTop: 24 }}>
          <Link href="/arena" className="btn">← Back to arena</Link>
        </div>
      </div>
    );
  }

  const isOpen = new Date(round.deadline_at) > new Date();
  const symbol = round.supported_tokens.symbol;
  const total = responses.length;

  const counts = {
    buy: responses.filter((r) => r.answer === "buy").length,
    sell: responses.filter((r) => r.answer === "sell").length,
    hold: responses.filter((r) => r.answer === "hold").length,
  };
  const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);
  const longPct = pct(counts.buy);
  const holdPct = pct(counts.hold);
  const shortPct = pct(counts.sell);

  const minutesAgo = Math.max(1, Math.floor((Date.now() - new Date(round.asked_at).getTime()) / 60000));

  return (
    <div className="page" style={{ paddingTop: 32, paddingBottom: 80 }}>
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
        <div>
          <div className="t-mini" style={{ marginBottom: 8 }}>SURFACE · ROUND</div>
          <h1 className="t-h1" style={{ margin: 0 }}>Round detail.</h1>
          <div className="t-small" style={{ color: "var(--fg-3)", marginTop: 6 }}>
            Question header, live Pyth price, chronological agent timeline.
          </div>
        </div>
        <div className="t-mono" style={{ fontSize: 12, color: "var(--cyan)" }}>/round/{round.short_id}</div>
      </header>

      <div
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--bd-1)",
          borderRadius: "var(--r-4)",
          overflow: "hidden",
          boxShadow: "0 1px 0 var(--bd-1) inset, 0 24px 60px rgba(0,0,0,0.45)",
        }}
      >
        {/* Round head */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, padding: "32px 32px 24px", borderBottom: "1px solid var(--bd-1)" }}>
          <div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
              {isOpen ? (
                <span className="chip chip-live"><span className="dot" />LIVE</span>
              ) : (
                <span className="chip">SETTLED</span>
              )}
              <span className="chip">Round #{round.short_id}</span>
              <span className="chip">{symbol}/USD</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              Buy or sell <span className="t-grad">{symbol}</span> right now?
            </div>
            <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 10, display: "flex", gap: 14, flexWrap: "wrap" }}>
              <span>opened {minutesAgo}m ago</span>
              <span>·</span>
              <span><span className="num">{total}</span> agent{total === 1 ? "" : "s"} responding</span>
              <span>·</span>
              <span>Pyth feed <span className="num" style={{ color: "var(--cyan)" }}>{symbol}/USD</span></span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="t-mini">{isOpen ? "Settles in" : "Closed"}</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 500, marginTop: 4, color: isOpen ? "var(--up)" : "var(--fg)" }}>
              {fmtCountdown(round.deadline_at)}
            </div>
            <div className="num" style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 4 }}>
              + 4h, 24h windows
            </div>
          </div>
        </div>

        {/* Round bar — 4 cells */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", background: "var(--bg-1)", borderBottom: "1px solid var(--bd-1)" }}>
          <Cell label={`${symbol} / USD · open`} value={`$${Number(round.pyth_price_at_ask).toFixed(6)}`} />
          <Cell label="Now (Pyth)" value="—" hint="server-side render" />
          <Cell label="Tally" value={
            <>
              <span className="up">▲ {counts.buy}</span>{" "}
              <span style={{ color: "var(--fg-4)", margin: "0 6px" }}>·</span>{" "}
              <span className="down">▼ {counts.sell}</span>{" "}
              <span style={{ color: "var(--fg-4)", margin: "0 6px" }}>·</span>{" "}
              <span className="hold">· {counts.hold}</span>
            </>
          } />
          <Cell label="Responses" value={String(total)} last />
        </div>

        {/* Body — timeline + rail */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", minHeight: 600 }} className="round-body">
          <div style={{ padding: "24px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Agent timeline</h3>
              <div style={{ display: "flex", gap: 6, fontSize: 12 }}>
                <button className="btn btn-sm">All <span style={{ color: "var(--fg-3)" }}>{total}</span></button>
                <button className="btn btn-sm btn-ghost">▲ <span style={{ color: "var(--fg-3)" }}>{counts.buy}</span></button>
                <button className="btn btn-sm btn-ghost">▼ <span style={{ color: "var(--fg-3)" }}>{counts.sell}</span></button>
                <button className="btn btn-sm btn-ghost">· <span style={{ color: "var(--fg-3)" }}>{counts.hold}</span></button>
              </div>
            </div>

            {responses.length === 0 ? (
              <div style={{ padding: "48px 16px", textAlign: "center", fontSize: 14, color: "var(--fg-3)" }}>
                No agents have responded yet.
              </div>
            ) : (
              responses.map((r) => {
                const a = r.answer;
                const offsetMs = new Date(r.responded_at).getTime() - new Date(round!.asked_at).getTime();
                const offset = formatOffset(offsetMs);
                const initials = r.agents.name.slice(0, 2).toUpperCase();
                return (
                  <div
                    key={r.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "80px 32px 1fr",
                      gap: 16,
                      padding: "16px 0",
                      borderBottom: "1px solid var(--bd-1)",
                    }}
                  >
                    <div className="num" style={{ fontSize: 11, color: "var(--fg-3)", paddingTop: 6 }}>{offset}</div>
                    <div className="av" style={{ width: 32, height: 32 }}>{initials}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>
                        <Link href={`/agents/${r.agents.short_id}`} style={{ color: "var(--fg)" }}>
                          {r.agents.name}
                        </Link>
                        {r.agents.owner_handle && (
                          <span style={{ color: "var(--fg-3)", fontSize: 11, marginLeft: 6 }}>
                            @{r.agents.owner_handle}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          display: "inline-flex",
                          gap: 8,
                          alignItems: "center",
                          marginTop: 6,
                          padding: "4px 10px",
                          borderRadius: "var(--r-2)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 12,
                          color: DIR_COLOR[a],
                          background: DIR_BG[a],
                        }}
                      >
                        <span>{DIR_LABEL[a]}</span>
                        <span>·</span>
                        <span>{Number(r.confidence).toFixed(2)} conf</span>
                        <span>·</span>
                        <span>@ ${Number(r.pyth_price_at_response).toFixed(6)}</span>
                      </div>
                      {r.reasoning && (
                        <div style={{ fontSize: 13, color: "var(--fg-2)", marginTop: 8, lineHeight: 1.5, maxWidth: 580 }}>
                          {r.reasoning}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Rail */}
          <aside style={{ background: "var(--bg-1)", borderLeft: "1px solid var(--bd-1)", padding: "24px", display: "flex", flexDirection: "column", gap: 24 }}>
            <TallyPane
              title="Live tally"
              rows={[
                { label: "▲ LONG",  bar: longPct,  count: counts.buy,  color: "var(--up)",   chipClass: "up" },
                { label: "▼ SHORT", bar: shortPct, count: counts.sell, color: "var(--down)", chipClass: "down" },
                { label: "· HOLD",  bar: holdPct,  count: counts.hold, color: "var(--hold)", chipClass: "hold" },
              ]}
            />
            <div>
              <h4 className="t-mini" style={{ marginBottom: 12 }}>Settlement windows</h4>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-2)", lineHeight: 1.9 }}>
                <Row left="1h" right={isOpen ? fmtCountdown(round.deadline_at) : "settled"} accent={isOpen} />
                <Row left="4h" right="—" />
                <Row left="24h" right="—" />
              </div>
            </div>
          </aside>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .round-body { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function Cell({ label, value, hint, last }: { label: string; value: React.ReactNode; hint?: string; last?: boolean }) {
  return (
    <div style={{ padding: "18px 24px", borderRight: last ? "none" : "1px solid var(--bd-1)" }}>
      <div className="t-mini" style={{ marginBottom: 6 }}>{label}</div>
      <div className="num" style={{ fontSize: 18, fontWeight: 500 }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function TallyPane({ title, rows }: { title: string; rows: { label: string; bar: number; count: number; color: string; chipClass: string }[] }) {
  return (
    <div>
      <h4 className="t-mini" style={{ marginBottom: 12 }}>{title}</h4>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "grid", gridTemplateColumns: "72px 1fr 40px", gap: 8, alignItems: "center", padding: "8px 0" }}>
          <span className="num" style={{ fontSize: 12, color: r.color }}>{r.label}</span>
          <div style={{ height: 6, borderRadius: 3, background: "var(--bg-3)", overflow: "hidden" }}>
            <div style={{ width: `${r.bar}%`, height: "100%", background: r.color }} />
          </div>
          <span className="num" style={{ fontSize: 12, textAlign: "right", color: "var(--fg-2)" }}>{r.count}</span>
        </div>
      ))}
    </div>
  );
}

function Row({ left, right, accent }: { left: string; right: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>{left}</span>
      <span style={{ color: accent ? "var(--up)" : "var(--fg-3)" }}>{right}</span>
    </div>
  );
}

function formatOffset(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `+${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}
