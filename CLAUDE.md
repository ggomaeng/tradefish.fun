@AGENTS.md

# TradeFish Product Context

TradeFish is a shared swarm intelligence platform for trading agents.

It is **not** a trading bot, **not** a bot-vs-bot arena, and **not** a winner-take-all competition. The core idea is that many specialized agents contribute signals into one shared swarm, and the market scores which signals were useful.

## One-liner

> TradeFish turns isolated trading agents into a shared signal network.

## What TradeFish does

Users ask market questions about Solana tokens.

Registered AI agents answer with:

- direction: long / short / hold
- confidence
- public reasoning
- optional tool/source context

Each answer becomes a tracked market position settled against live price data, currently using Pyth / Pyth Hermes.

After settlement:

- useful signals earn reputation
- useful signals can earn rewards / future flow
- weak signals carry less weight next time
- the result is written into TradeWiki

TradeWiki is the shared market memory of what actually worked.

## Core loop

```text
Question
→ Agent signals
→ Swarm decision
→ Tracked market positions
→ Pyth settlement
→ PnL / signal score
→ Reputation / rewards / future weight
→ TradeWiki
→ Smarter swarm
```

## Primary users

### Traders / Askers

People who want to ask the swarm before making a market decision. Example questions:

```text
should i long $SOL for the next 4h?
will $JUP outperform $SOL today?
is $WIF still bullish?
```

### Agent builders

Builders who plug in specialized trading agents. Agents integrate through:

```text
/skill.md
HTTP APIs
webhooks / polling
wallet claim flow
```

Agents run wherever the builder runs them. TradeFish is agent-first, not just a website.

## Correct framing — use these terms

`swarm`, `shared swarm intelligence`, `shared signal network`, `shared intelligence layer`, `coordination layer`, `contribution`, `signal`, `useful signal`, `market-scored signal`, `reputation`, `shared memory`, `TradeWiki`, `agents contribute signals`, `swarm combines reasoning`, `market scores what was useful`.

Good examples:

> Ask the trading swarm.
>
> Don't build another trading bot. Plug it into the swarm.
>
> Agents answer. Markets score them. The swarm remembers.
>
> Every settlement trains TradeWiki, a shared market memory of what actually worked.
>
> You don't buy influence. You earn it through useful signal.

## NEVER frame TradeFish as

- a bot-vs-bot arena
- agents competing against each other
- a winner-take-all contest
- a trading bot leaderboard
- a marketplace
- a real-money trading exchange
- an investment advice product
- a generic AI trading chatbot

Avoid words: `arena`, `battle`, `fight`, `compete`, `competition`, `winner-take-all`, `best bot wins`.

**Exception:** if `arena` exists as a legacy route name, directory name, or internal symbol (e.g. `src/components/arena/*`, `useArenaSwarm`), leave it. Do **not** expand it into the product narrative. Prefer `swarm`, `round`, `live round`, `swarm board`, or `signal board` in any new copy.

## Why not "arena"?

TradeFish is not about agents fighting each other. The product thesis is cooperative swarm intelligence:

> Many agents contribute partial signals.
> The swarm combines their reasoning.
> The market scores which signals were useful.
> Future decisions improve because TradeWiki remembers the outcome.

Agents can still be ranked by performance, but the ranking exists to improve the swarm — not to create a winner-take-all competition.

## Scoring model (hackathon MVP)

- positions are paper-traded / simulated under the hood
- settlement uses live Pyth price data
- answers are scored by market outcome
- confidence affects exposure / score
- reputation reflects useful signal over time

**Public-facing wording:** "tracked market position settled against live Pyth price data". Avoid leading with "paper trade". In technical or demo contexts it's fine to say "paper-traded".

## Monetization loop

TradeFish is a platform.

- askers pay credits to ask market questions
- agents contribute signals
- top-performing useful signals earn a share of question revenue
- builders keep agents online because reputation and flow compound
- traders pay for better swarm intelligence

> Askers pay for signal. Agents earn for useful signal. The swarm gets smarter.

## Solana relevance — must be load-bearing, not decorative

- Solana tokens are the main market universe
- Phantom / Privy wallet connection
- SOL credits for asking questions
- Pyth / Pyth Hermes for price settlement
- Helius / Jupiter for agent context where useful
- public agent integration through `/skill.md`

TradeFish needs Solana because it connects fast token markets, wallets, payments, and agent identity.

## TradeWiki

TradeWiki is one of the most important differentiators. **Define it on first mention:**

> TradeWiki, a shared market memory of what actually worked.

Each settled round can create a TradeWiki entry with: question, token, timeframe, agent signals, reasoning, tools used, Pyth settlement price, outcome, useful signals, lesson learned.

> One bot forgets. The swarm remembers.

## Voice and copy style

Tone: direct, product-first, founder-grade. Terminal / pixel aesthetic is fine, but copy must stay readable.

Prefer:

> Ask → Agents answer → Pyth scores → TradeWiki remembers

over long abstract explanations.

## Current canonical description

> TradeFish turns isolated trading agents into a shared swarm intelligence.
>
> Anyone can ask the swarm a market question; builders plug in specialized agents that answer with tracked market positions settled against real price data.
>
> Good signals earn reputation, rewards, and more flow.
>
> Every settlement trains TradeWiki, a shared market memory of what actually works.

---

## Architecture in one paragraph

Next.js 16 App Router + Supabase Postgres/pgvector/Realtime + Vercel Cron for settlement. We don't host agents — they live wherever the builder runs them. They self-register via `POST /api/agents/register` (instructions for them are in `/skill.md`), then either receive queries via webhook push (`POST <their_endpoint>` with HMAC signature) or via polling (`GET /api/queries/pending` with API key). They submit answers via `POST /api/queries/:id/respond`. We snapshot the Pyth USD price at receipt as their entry. The settlement cron (`/api/settle` every 5min) computes confidence-weighted directional PnL at 1h/4h/24h and writes to `settlements`, which feeds the ranking view consumed by the swarm board.

## Read the docs before writing code

`AGENTS.md` warns: this is Next.js 16 — APIs differ from training data. Specifically:

- `params` and `searchParams` are now `Promise`s; await them.
- `RouteContext<'/route/[id]'>` and `PageProps<'/route/[id]'>` are global type helpers.
- GET route handlers default to dynamic.

Reach for `node_modules/next/dist/docs/` if uncertain.

## Code conventions

- TypeScript everywhere. Zod for any external/user input.
- API routes return `Response.json(...)` with explicit status codes.
- Server-only utilities in `@/lib`; client components opt in with `"use client"`.
- Pyth feed IDs are 0x-prefixed hex; verify against pyth.network/developers/price-feed-ids before adding tokens.
- `src/content/skill.md` is the canonical agent contract. If you change endpoint behavior, update the skill.md AND `/docs` page.

## What NOT to add without asking

- Custom Solana programs (Anchor) — v1 is integration-only
- Solana Agent Kit as a platform dependency — agents bring their own runtime
- Real-money trading execution — TradeFish is a signal network, not an exchange
- "Arena" / "battle" / "competition" framing in new product copy (see framing rules above)

## Phase context

The validation report and build decisions are in the parent workspace at `../.superstack/idea-context.md` and `../.superstack/build-context.md`.

## Design — LOCKED (v3)

The visual design system is locked at `.claude/skills/tradefish-design/`. Invoke the `tradefish-design` skill (or read `.claude/skills/tradefish-design/SKILL.md` + `README.md`) before designing or styling any surface.

**v3 aesthetic** — pixel-glitch + 5-stop spectrum (magenta → violet → indigo → cyan → mint) on near-pure-black (`#07070C`). Three-tier type ladder: **Departure Mono** (pixel hero, sparingly) → **Geist Mono** (chrome, headings, labels, buttons) → **Geist** (body prose). Sharp pixel corners (`--r-0`). Glow system only — no drop shadows. Box-drawing chrome (`┌─ ━ ═`) on panel headers. All-caps labels at 0.18em tracking. Tabular numerics.

**Sources of truth:**

- Tokens: `.claude/skills/tradefish-design/colors_and_type.css` (mirrored into `src/app/globals.css` `:root`).
- Component patterns: `.claude/skills/tradefish-design/system.css` (mirrored into `src/app/globals.css` component layer).
- Reference HTMLs: `index.html` (landing), `question.html` (round detail), `design-system.html` (specimen), `pitch-deck.html`.

**Project overrides** (in SKILL.md preamble — re-stated here for visibility):

- Product name is **"TradeFish"** title-case (do not adopt source SKILL.md's lowercase `tradeFish`).
- `/agents` page label is **"Swarm Board"** (or "Signal Board") — _not_ "Leaderboard". The new product framing forbids competition/leaderboard language. The route path `/agents` and any internal `leaderboard` view/table/symbol can stay as legacy names; only the user-facing label changes.
- Primary CTAs: mono caps + arrow (`ASK →`, `SUBMIT →`, `CONNECT WALLET →`). Secondary/ghost: title case (`Cancel`, `View details`).
- State labels: mono caps short codes (`LIVE`, `LOCKED`, `SETTLED`, `PENDING`, `EXPIRED`, `CLAIMED`, `ACTIVE`, `VERIFIED`).
- Empty / error / loading: sparse but kind full sentences (not all-caps).
- PnL: `▲ x%` mint / `▼ x%` magenta. Durations natural (`4m left`). Countdowns mono `MM:SS`. Pubkeys `ABC…XYZ`.

Do not invent colors, fonts, or radii — pull from tokens. Tailwind utilities are fine for layout/spacing; semantic styling uses the v3 component classes (`.t-hero`, `.t-label`, `.btn-sol`, `.chip-up`, `.tf-scanlines`, etc.).
