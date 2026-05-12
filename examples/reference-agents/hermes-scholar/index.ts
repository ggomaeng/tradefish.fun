/**
 * Hermes Scholar — TradeFish reference Brain agent
 *
 * Reads settled rounds from the platform, distills each one into a structured
 * lesson (title, content, tokens, tags) via an LLM, and posts it to the
 * /api/brain/ingest endpoint so it becomes searchable knowledge in the Brain tab.
 *
 * This is a *write-only* agent: it does not answer trading queries. Its job is
 * to grow the wiki so that trading agents (like claude-momentum) get better
 * context on their next fetch of /api/wiki/search.
 *
 * Usage:
 *   1. cp .env.example .env  (fill in TRADEFISH_API, SCHOLAR_API_KEY, OPENAI_API_KEY)
 *   2. npm install
 *   3. npm run dev
 *
 * See README.md for full documentation.
 */

import "dotenv/config";
import OpenAI from "openai";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TRADEFISH_API = (process.env.TRADEFISH_API ?? "https://tradefish.fun").replace(/\/$/, "");
const SCHOLAR_API_KEY = process.env.SCHOLAR_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || undefined;
const SCHOLAR_MODEL = process.env.SCHOLAR_MODEL ?? "gpt-4o-mini";
const MAX_INGESTS_PER_HOUR = parseInt(process.env.MAX_INGESTS_PER_HOUR ?? "20", 10);
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? "300000", 10);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, "state.json");

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

if (!SCHOLAR_API_KEY) {
  console.error("SCHOLAR_API_KEY not set. Obtain one from the TradeFish platform.");
  process.exit(1);
}
if (!OPENAI_API_KEY && !OPENAI_BASE_URL) {
  console.error("OPENAI_API_KEY not set. Set it or provide OPENAI_BASE_URL for a local provider.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// OpenAI client (supports any OpenAI-compatible provider via OPENAI_BASE_URL)
// ---------------------------------------------------------------------------

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY ?? "unused", // local providers may not need a real key
  ...(OPENAI_BASE_URL ? { baseURL: OPENAI_BASE_URL } : {}),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single settled round from GET /api/rounds/settled.
 * TODO: validate against actual response shape once P1/P2 land.
 */
type SettledRound = {
  id: string;
  token_mint: string;
  token_symbol: string;
  token_name: string;
  question_type: string;
  asked_at: string;
  settled_at: string;
  entry_price_usd: number;
  exit_price_usd: number;
  price_change_pct: number;
  /** Winning direction: "buy" | "sell" | "hold" */
  outcome: string;
  /** Top agent responses, ordered by PnL desc. */
  top_responses: Array<{
    agent_name: string;
    answer: string;
    confidence: number;
    reasoning: string;
    pnl_usd: number;
  }>;
};

/**
 * Shape returned by GET /api/rounds/settled.
 * TODO: validate against actual response shape once P1/P2 land.
 */
type SettledRoundsResponse = {
  rounds: SettledRound[];
};

/**
 * Distilled lesson produced by the LLM and posted to /api/brain/ingest.
 * Matches the Brain ingest payload shape from the spec.
 */
type LessonPayload = {
  title: string;
  content: string;
  /** Token symbols mentioned in the lesson, e.g. ["SOL", "JUP"] */
  tokens: string[];
  /** Semantic tags, e.g. ["momentum", "breakout", "high-confidence"] */
  tags: string[];
  /** Round that this lesson was distilled from */
  source_round_id: string;
};

// ---------------------------------------------------------------------------
// State persistence
// ---------------------------------------------------------------------------

type State = {
  last_run_at: string | null;
};

async function loadState(): Promise<State> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    return JSON.parse(raw) as State;
  } catch {
    return { last_run_at: null };
  }
}

async function saveState(state: State): Promise<void> {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/**
 * Fetch settled rounds since `since` (ISO 8601).
 * TODO: validate against actual response shape once P1/P2 land.
 */
async function fetchSettledRounds(since: string): Promise<SettledRound[]> {
  const url = `${TRADEFISH_API}/api/rounds/settled?since=${encodeURIComponent(since)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${SCHOLAR_API_KEY}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET /api/rounds/settled failed ${res.status}: ${body.slice(0, 300)}`);
  }
  // TODO: validate against actual response shape once P1/P2 land.
  const json = (await res.json()) as SettledRoundsResponse;
  return json.rounds ?? [];
}

/**
 * Post a distilled lesson to /api/brain/ingest.
 * Returns the server's response body.
 * TODO: validate against actual response shape once P2 lands.
 */
async function ingestLesson(lesson: LessonPayload): Promise<{ status: "inserted" | "merged" | "duplicate"; node_id?: string }> {
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
  // TODO: validate against actual response shape once P2 lands.
  return res.json();
}

// ---------------------------------------------------------------------------
// Distillation prompt
// ---------------------------------------------------------------------------

function buildDistillationPrompt(round: SettledRound): string {
  const topResponses = round.top_responses
    .slice(0, 5)
    .map(
      (r, i) =>
        `  ${i + 1}. [${r.agent_name}] answer=${r.answer} conf=${r.confidence.toFixed(2)} pnl=$${r.pnl_usd.toFixed(4)}\n     reasoning: ${r.reasoning}`
    )
    .join("\n");

  return `You are Hermes Scholar, a financial knowledge distiller for the TradeFish platform.

A trading round has just been settled. Your job is to extract a concise, durable lesson that will help future trading agents make better decisions.

## Round data
- Token: ${round.token_symbol} (${round.token_name})
- Question: ${round.question_type}
- Entry price: $${round.entry_price_usd}
- Exit price: $${round.exit_price_usd}
- Price change: ${round.price_change_pct > 0 ? "+" : ""}${round.price_change_pct.toFixed(2)}%
- Outcome: ${round.outcome}
- Settled: ${round.settled_at}

## Top agent responses
${topResponses || "  (no responses recorded)"}

## Instructions
Write a short, practical lesson that a trading agent could use as context in a future round.
Focus on:
- What signal or pattern distinguished the winners from losers (if any)
- What the price action reveals about ${round.token_symbol}'s current behavior
- Any calibration notes (e.g. "high confidence was warranted here" or "confidence > 0.8 overfit")

Respond ONLY with valid JSON matching this exact shape:
{
  "title": "short title ≤80 chars",
  "content": "markdown body, 2-5 sentences, no lists, no headers",
  "tokens": ["SYMBOL1", "SYMBOL2"],
  "tags": ["tag1", "tag2", "tag3"]
}

Keep "content" under 500 characters. Use only lowercase for tags (e.g. "momentum", "reversal", "high-confidence", "low-volume").`;
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
  // Defensive: extract the first JSON object even if the model adds surrounding text.
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

  // Normalise and validate fields defensively.
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
// Rate-limiter (simple in-process token bucket)
// ---------------------------------------------------------------------------

class HourlyRateLimiter {
  private count = 0;
  private windowStart = Date.now();

  constructor(private readonly max: number) {}

  private reset() {
    this.count = 0;
    this.windowStart = Date.now();
  }

  /** Returns ms to wait (0 if OK to proceed immediately). */
  check(): number {
    const now = Date.now();
    if (now - this.windowStart >= 3_600_000) {
      this.reset();
    }
    if (this.count >= this.max) {
      const msUntilReset = 3_600_000 - (now - this.windowStart);
      return msUntilReset;
    }
    return 0;
  }

  increment() {
    this.count++;
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

const rateLimiter = new HourlyRateLimiter(MAX_INGESTS_PER_HOUR);

async function tick() {
  const state = await loadState();

  // Default: one hour ago if no prior run.
  const since =
    state.last_run_at ??
    new Date(Date.now() - 60 * 60 * 1_000).toISOString();

  console.log(`[scholar] fetching settled rounds since ${since}`);

  let rounds: SettledRound[];
  try {
    rounds = await fetchSettledRounds(since);
  } catch (err) {
    console.error("[scholar] failed to fetch rounds:", err);
    return;
  }

  if (rounds.length === 0) {
    console.log("[scholar] no new settled rounds");
  } else {
    console.log(`[scholar] ${rounds.length} round(s) to distil`);
  }

  const nowIso = new Date().toISOString();

  for (const round of rounds) {
    // Rate-limit check.
    const waitMs = rateLimiter.check();
    if (waitMs > 0) {
      console.warn(
        `[scholar] rate limit reached (${MAX_INGESTS_PER_HOUR}/hr). Sleeping ${Math.ceil(waitMs / 1000)}s...`
      );
      await new Promise((r) => setTimeout(r, waitMs));
      rateLimiter["reset"]?.(); // reset after waiting (bucket resets on next check)
    }

    try {
      const lesson = await distillRound(round);
      const payload: LessonPayload = { ...lesson, source_round_id: round.id };

      const result = await ingestLesson(payload);
      rateLimiter.increment();

      console.log(
        `[scholar] round=${round.id.slice(0, 8)} ${result.status}` +
          (result.node_id ? ` node=${result.node_id.slice(0, 8)}` : "") +
          ` title="${lesson.title.slice(0, 50)}"`
      );
    } catch (err) {
      console.error(`[scholar] round=${round.id.slice(0, 8)} failed:`, err);
      // Continue processing remaining rounds — don't abort the batch.
    }
  }

  // Persist last-run timestamp *after* processing (so a crash mid-batch won't
  // skip rounds entirely on the next run — we'll re-fetch some, but ingest is
  // idempotent on source_round_id so duplicates are harmless).
  await saveState({ last_run_at: nowIso });
  console.log(`[scholar] done. Next run at ${new Date(Date.now() + POLL_INTERVAL_MS).toISOString()}`);
}

console.log(
  `Hermes Scholar online. Model=${SCHOLAR_MODEL} max=${MAX_INGESTS_PER_HOUR}/hr poll=${POLL_INTERVAL_MS}ms`
);
tick();
setInterval(tick, POLL_INTERVAL_MS);
