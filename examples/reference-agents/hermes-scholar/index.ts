/**
 * Hermes Scholar — TradeFish Brain agent (v1 trade model)
 *
 * Polls Supabase directly for settled rounds (queries.status='settled'),
 * distils each round into a structured lesson via GPT 5.5, and POSTs
 * to /api/brain/ingest.
 *
 * Polling strategy: OPTION A — direct Supabase query via service-role key.
 * Rationale: GET /api/rounds/settled does not exist yet in the platform.
 * Direct DB access avoids adding a platform endpoint as a deployment blocker
 * and is safe with the service-role key scoped to this agent's host.
 *
 * v1 trade-model semantics (PR #20, 0014_v1_trade_model.sql):
 *   - Each settled round has ONE paper_trades.pnl_usd per response.
 *   - 10x leverage on position_size_usd.
 *   - No per-horizon (1h/4h/24h) structure — one settle event per round.
 *
 * Usage:
 *   1. cp .env.example .env  (fill in all vars — see README-taco.md)
 *   2. npm install
 *   3. DRY_RUN=1 npx tsx index.ts   (verify without posting)
 *   4. npx tsx index.ts              (live run)
 */

import "dotenv/config";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TRADEFISH_API = (process.env.TRADEFISH_API ?? "").replace(/\/$/, "");
const SCHOLAR_API_KEY = process.env.SCHOLAR_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || undefined;
const SCHOLAR_MODEL = process.env.SCHOLAR_MODEL ?? "gpt-5.5";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAX_INGESTS_PER_HOUR = parseInt(process.env.MAX_INGESTS_PER_HOUR ?? "20", 10);
const DRY_RUN = process.env.DRY_RUN === "1";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, "state.json");
const LOG_FILE = path.join(__dirname, "log.txt");

// ---------------------------------------------------------------------------
// Dual logger: stdout + log.txt
// ---------------------------------------------------------------------------

const logStream = createWriteStream(LOG_FILE, { flags: "a" });

function log(...args: unknown[]) {
  const line = `[${new Date().toISOString()}] ${args.map(String).join(" ")}`;
  console.log(line);
  logStream.write(line + "\n");
}

function logError(...args: unknown[]) {
  const line = `[${new Date().toISOString()}] ERROR ${args.map(String).join(" ")}`;
  console.error(line);
  logStream.write(line + "\n");
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  logError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}
if (!SCHOLAR_API_KEY && !DRY_RUN) {
  logError("SCHOLAR_API_KEY not set. Obtain one from the TradeFish platform.");
  process.exit(1);
}
if (!OPENAI_API_KEY && !OPENAI_BASE_URL) {
  logError("OPENAI_API_KEY not set. Set it or provide OPENAI_BASE_URL for a compatible provider.");
  process.exit(1);
}
if (!TRADEFISH_API && !DRY_RUN) {
  logError("TRADEFISH_API not set. Set to https://<your-staging-or-prod-host>.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY ?? "unused",
  ...(OPENAI_BASE_URL ? { baseURL: OPENAI_BASE_URL } : {}),
});

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Trade = {
  agent_name: string;
  direction: "buy" | "sell" | "hold";
  confidence: number;
  position_size_usd: number;
  entry_price: number;
  exit_price: number;
  pnl_usd: number;
  reasoning: string | null;  // responses.reasoning — quoted in diary entries
};

type SettledRound = {
  id: string;
  token_mint: string;
  token_symbol: string;
  token_name: string;
  question_type: string;
  asked_at: string;
  settled_at: string;
  entry_price_usd: number;   // pyth_price_at_ask
  close_price_usd: number;   // close_price_pyth
  trades: Trade[];
};

type LessonPayload = {
  title: string;
  content: string;
  tokens: string[];
  tags: string[];
  source_round_id: string;
};

// ---------------------------------------------------------------------------
// State persistence
// ---------------------------------------------------------------------------

type State = {
  last_run_at: string | null;
  ingests_this_hour: number;
  hour_window_start: string | null;
};

async function loadState(): Promise<State> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    return JSON.parse(raw) as State;
  } catch {
    return { last_run_at: null, ingests_this_hour: 0, hour_window_start: null };
  }
}

async function saveState(state: State): Promise<void> {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// Supabase polling (Option A — direct DB query)
// ---------------------------------------------------------------------------

async function fetchSettledRounds(since: string): Promise<SettledRound[]> {
  // Join: queries (settled, since) → supported_tokens → responses → agents → paper_trades
  const { data: queries, error: qErr } = await supabase
    .from("queries")
    .select(
      `
      id,
      token_mint,
      question_type,
      asked_at,
      settled_at,
      pyth_price_at_ask,
      close_price_pyth,
      supported_tokens!inner (symbol, name),
      responses (
        id,
        answer,
        confidence,
        reasoning,
        position_size_usd,
        pyth_price_at_response,
        agents!inner (name),
        paper_trades (pnl_usd, entry_price, exit_price, direction, position_size_usd)
      )
    `
    )
    .eq("status", "settled")
    .gt("settled_at", since)
    .order("settled_at", { ascending: true })
    .limit(50);

  if (qErr) {
    throw new Error(`Supabase query failed: ${qErr.message}`);
  }
  if (!queries || queries.length === 0) return [];

  return queries.map((q: any): SettledRound => {
    const responses: any[] = q.responses ?? [];
    const trades: Trade[] = responses
      .filter((r: any) => r.paper_trades && r.paper_trades.length > 0)
      .map((r: any) => {
        const pt = r.paper_trades[0];
        return {
          agent_name: r.agents?.name ?? "unknown",
          direction: pt.direction,
          confidence: parseFloat(r.confidence),
          position_size_usd: parseFloat(pt.position_size_usd),
          entry_price: parseFloat(pt.entry_price),
          exit_price: parseFloat(pt.exit_price),
          pnl_usd: parseFloat(pt.pnl_usd),
          reasoning: r.reasoning ?? null,
        };
      })
      .sort((a, b) => b.pnl_usd - a.pnl_usd);

    return {
      id: q.id,
      token_mint: q.token_mint,
      token_symbol: q.supported_tokens?.symbol ?? q.token_mint,
      token_name: q.supported_tokens?.name ?? q.token_mint,
      question_type: q.question_type,
      asked_at: q.asked_at,
      settled_at: q.settled_at,
      entry_price_usd: parseFloat(q.pyth_price_at_ask),
      close_price_usd: parseFloat(q.close_price_pyth ?? q.pyth_price_at_ask),
      trades,
    };
  });
}

// ---------------------------------------------------------------------------
// Distillation prompt (v1 semantics — single pnl_usd per trade, 10x leverage)
// ---------------------------------------------------------------------------

function buildDistillationPrompt(round: SettledRound): string {
  const priceChange = round.entry_price_usd > 0
    ? (((round.close_price_usd - round.entry_price_usd) / round.entry_price_usd) * 100).toFixed(2)
    : "0.00";
  const direction = round.close_price_usd >= round.entry_price_usd ? "UP" : "DOWN";

  const tradeLines = round.trades
    .slice(0, 8)
    .map((t) => {
      const reasoning = t.reasoning ? ` — "${t.reasoning.slice(0, 140)}"` : "";
      return (
        `  - ${t.agent_name}: ${t.direction.toUpperCase()} @ ${t.confidence.toFixed(2)} conf` +
        ` · $${t.position_size_usd.toFixed(0)} → ${t.pnl_usd >= 0 ? "+" : ""}$${t.pnl_usd.toFixed(2)} PnL${reasoning}`
      );
    })
    .join("\n");

  // Classify the outcome for the structured tag.
  const winners = round.trades.filter((t) => t.pnl_usd > 0);
  const losers = round.trades.filter((t) => t.pnl_usd < 0);
  const majorityBuy = round.trades.filter((t) => t.direction === "buy").length >
                      round.trades.filter((t) => t.direction === "sell").length;
  const priceWentUp = round.close_price_usd > round.entry_price_usd;
  let outcomeHint = "outcome:mixed";
  if (winners.length === 0 && losers.length === 0) outcomeHint = "outcome:flat";
  else if (majorityBuy === priceWentUp) outcomeHint = "outcome:consensus-won";
  else outcomeHint = "outcome:contrarian-won";

  return `You are the brain's diarist. A round just settled on tradefish — write the
diary entry that future agents will read BEFORE they make the same call.

Round: ${round.token_symbol} (${round.token_mint})
Pyth entry → close: $${round.entry_price_usd} → $${round.close_price_usd} (${direction} ${priceChange}%)
Trades on this round (10× leveraged):
${tradeLines || "  (no trades recorded)"}

Write a faithful diary entry, NOT a textbook lesson. Cover, in order:
1. WHAT HAPPENED — outcome in one sentence (who won, who lost, by how much).
2. WHO WAS WRONG AND WHY — for each losing agent, name the assumption that
   broke. Quote their reasoning if it's available above.
3. WHO WAS RIGHT AND WHY — what did the winners see that the others missed?
4. WHAT TO REMEMBER — one falsifiable pattern, framed conditionally
   ("when X happens on Solana, expect Y"). If nothing generalizable can
   honestly be drawn from this round, write "this round was noise" — that
   is a valid entry. Do not invent patterns.

Voice: an honest trader's journal. Include the embarrassing parts. Avoid
hedging ("could be", "might"), survivorship bias, and moralizing. Quote
real agent reasoning where shown. Keep the title concrete and narrative
(e.g. "BONK fakeout — Hermes shorted dispersion, retail won"), NOT a
textbook heading.

Tags MUST include exactly one of: outcome:consensus-won,
outcome:contrarian-won, outcome:mixed, outcome:flat.
Based on this round's data the suggested outcome tag is "${outcomeHint}".

Output JSON (no surrounding prose):
{
  "title": "...",       // ~6-12 words, narrative, no period at the end
  "content": "...",     // ~120-200 words, the diary entry above
  "tokens": [...],      // tickers mentioned (uppercased)
  "tags": [...]         // include the outcome:* tag plus 2-5 topical tags
}`;
}

// ---------------------------------------------------------------------------
// LLM distillation
// ---------------------------------------------------------------------------

async function distillRound(round: SettledRound): Promise<Omit<LessonPayload, "source_round_id">> {
  const prompt = buildDistillationPrompt(round);

  const completion = await openai.chat.completions.create({
    model: SCHOLAR_MODEL,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
    max_tokens: 512,
    temperature: 0.3,
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`No JSON in LLM response: ${raw.slice(0, 200)}`);
  }

  const parsed = JSON.parse(match[0]) as {
    title?: string;
    content?: string;
    tokens?: unknown;
    tags?: unknown;
  };

  const title = String(parsed.title ?? `${round.token_symbol} lesson ${round.id.slice(0, 8)}`).slice(0, 80);
  const content = String(parsed.content ?? "").slice(0, 600);
  const tokens = Array.isArray(parsed.tokens)
    ? (parsed.tokens as unknown[]).filter((t): t is string => typeof t === "string").map((t) => t.toUpperCase())
    : [round.token_symbol.toUpperCase()];
  const tags = Array.isArray(parsed.tags)
    ? (parsed.tags as unknown[]).filter((t): t is string => typeof t === "string").map((t) => t.toLowerCase())
    : [];

  return { title, content, tokens, tags };
}

// ---------------------------------------------------------------------------
// Ingest
// ---------------------------------------------------------------------------

async function ingestLesson(
  lesson: LessonPayload
): Promise<{ status: "inserted" | "merged" | "duplicate"; node_id?: string }> {
  if (DRY_RUN) {
    log("[DRY_RUN] Would POST to /api/brain/ingest:", JSON.stringify(lesson, null, 2));
    return { status: "inserted" };
  }

  const res = await fetch(`${TRADEFISH_API}/api/brain/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SCHOLAR_API_KEY}`,
    },
    body: JSON.stringify(lesson),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`POST /api/brain/ingest failed ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Rate-limit helpers (persisted via state.json)
// ---------------------------------------------------------------------------

function checkRateLimit(state: State): boolean {
  const now = Date.now();
  const windowStart = state.hour_window_start ? new Date(state.hour_window_start).getTime() : now;
  if (now - windowStart >= 3_600_000) {
    // New hour — reset
    state.ingests_this_hour = 0;
    state.hour_window_start = new Date().toISOString();
  }
  return state.ingests_this_hour < MAX_INGESTS_PER_HOUR;
}

// ---------------------------------------------------------------------------
// Main tick
// ---------------------------------------------------------------------------

async function tick() {
  const state = await loadState();

  const since = state.last_run_at ?? new Date(Date.now() - 60 * 60 * 1_000).toISOString();

  log(`[scholar] fetching settled rounds since ${since}${DRY_RUN ? " [DRY_RUN]" : ""}`);

  let rounds: SettledRound[];
  try {
    rounds = await fetchSettledRounds(since);
  } catch (err) {
    logError("[scholar] failed to fetch rounds:", err);
    return;
  }

  if (rounds.length === 0) {
    log("[scholar] no new settled rounds");
  } else {
    log(`[scholar] ${rounds.length} round(s) to distil`);
  }

  const nowIso = new Date().toISOString();

  for (const round of rounds) {
    if (!checkRateLimit(state)) {
      log(`[scholar] rate limit reached (${MAX_INGESTS_PER_HOUR}/hr). Skipping remaining rounds.`);
      break;
    }

    try {
      const lesson = await distillRound(round);
      const payload: LessonPayload = { ...lesson, source_round_id: round.id };

      const result = await ingestLesson(payload);
      if (!DRY_RUN) {
        state.ingests_this_hour = (state.ingests_this_hour ?? 0) + 1;
      }

      log(
        `[scholar] round=${round.id.slice(0, 8)} ${result.status}` +
          (result.node_id ? ` node=${result.node_id.slice(0, 8)}` : "") +
          ` title="${lesson.title.slice(0, 50)}"` +
          (DRY_RUN ? " [DRY_RUN]" : "")
      );
    } catch (err) {
      logError(`[scholar] round=${round.id.slice(0, 8)} failed:`, err);
    }
  }

  await saveState({ ...state, last_run_at: nowIso });
  log(`[scholar] done. State saved. last_run_at=${nowIso}`);
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

log(`Hermes Scholar online. model=${SCHOLAR_MODEL} max=${MAX_INGESTS_PER_HOUR}/hr dry_run=${DRY_RUN}`);
tick().catch((err) => {
  logError("Unhandled tick error:", err);
  process.exit(1);
});
