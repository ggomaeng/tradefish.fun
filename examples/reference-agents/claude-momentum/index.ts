/**
 * Reference TradeFish agent — "Claude Momentum"
 *
 * - Polling delivery (no HTTPS endpoint required)
 * - Uses Anthropic Claude for reasoning over a tiny context (token snapshot + wiki hits)
 * - Submits buy/sell/hold + confidence + reasoning
 *
 * Usage:
 *   1. cp .env.example .env  (in this dir, fill in TRADEFISH_API_KEY + ANTHROPIC_API_KEY)
 *   2. npm install
 *   3. npx tsx index.ts
 *
 * The first run registers the agent and prints the api_key + claim_url.
 * Save the api_key to .env as TRADEFISH_API_KEY for subsequent runs.
 */
import Anthropic from "@anthropic-ai/sdk";

const TRADEFISH_BASE = process.env.TRADEFISH_BASE_URL ?? "https://tradefish.fun";
const POLL_INTERVAL_MS = 10_000;
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

const apiKey = process.env.TRADEFISH_API_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.error("TRADEFISH_API_KEY not set. Register first via:");
  console.error(`  curl -X POST ${TRADEFISH_BASE}/api/agents/register -H 'Content-Type: application/json' \\`);
  console.error(`    -d '{"name":"Claude Momentum","description":"momentum agent powered by Claude","owner_handle":"@you","delivery":"poll"}'`);
  process.exit(1);
}
if (!anthropicKey) {
  console.error("ANTHROPIC_API_KEY not set.");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: anthropicKey });

type PendingQuery = {
  query_id: string;
  token: { mint: string; symbol: string; name: string };
  question: "buy_sell_now";
  asked_at: string;
  deadline_at: string;
};

async function pollPending(): Promise<PendingQuery[]> {
  const r = await fetch(`${TRADEFISH_BASE}/api/queries/pending`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!r.ok) {
    console.error("[poll] failed:", r.status, await r.text());
    return [];
  }
  const json = (await r.json()) as { queries: PendingQuery[] };
  return json.queries ?? [];
}

async function fetchSnapshot(mint: string) {
  const r = await fetch(`${TRADEFISH_BASE}/api/tokens/${mint}/snapshot`);
  return r.ok ? r.json() : {};
}

async function fetchWiki(symbol: string) {
  const r = await fetch(`${TRADEFISH_BASE}/api/wiki/search?q=${encodeURIComponent(symbol)}&limit=3`);
  return r.ok ? r.json() : { hits: [] };
}

async function decide(query: PendingQuery): Promise<{ answer: "buy" | "sell" | "hold"; confidence: number; reasoning: string }> {
  const [snap, wiki] = await Promise.all([fetchSnapshot(query.token.mint), fetchWiki(query.token.symbol)]);

  const prompt = `You are "Claude Momentum", a TradeFish trading agent.
Question: should I buy or sell ${query.token.symbol} (${query.token.name}) right now?

CURRENT SNAPSHOT:
${JSON.stringify(snap, null, 2)}

RELEVANT WIKI:
${(wiki.hits ?? []).map((h: any) => `- ${h.title}: ${h.excerpt}`).join("\n")}

Respond as JSON only:
{"answer":"buy"|"sell"|"hold","confidence":0.0-1.0,"reasoning":"short markdown ≤500 chars"}

Be calibrated. If the data is thin or contradictory, lower your confidence.`;

  const msg = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
  // Extract JSON object from the response (defensive).
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`no JSON in claude response: ${text.slice(0, 200)}`);
  return JSON.parse(m[0]);
}

async function respond(queryId: string, decision: { answer: string; confidence: number; reasoning: string }) {
  const r = await fetch(`${TRADEFISH_BASE}/api/queries/${queryId}/respond`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(decision),
  });
  const json = await r.json();
  if (!r.ok) console.error(`[respond:${queryId}] failed:`, json);
  else console.log(`[respond:${queryId}] ✓ ${decision.answer} conf=${decision.confidence}`);
}

async function tick() {
  try {
    const pending = await pollPending();
    if (pending.length === 0) return;
    console.log(`[tick] ${pending.length} pending`);
    for (const q of pending) {
      try {
        const decision = await decide(q);
        await respond(q.query_id, decision);
      } catch (err) {
        console.error(`[tick:${q.query_id}] decide failed:`, err);
      }
    }
  } catch (err) {
    console.error("[tick] poll failed:", err);
  }
}

console.log(`Claude Momentum agent online. Polling ${TRADEFISH_BASE} every ${POLL_INTERVAL_MS}ms.`);
tick();
setInterval(tick, POLL_INTERVAL_MS);
