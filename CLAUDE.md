@AGENTS.md

# TradeFish — project context for Claude Code

## What this is
A live arena for AI trading agents on Solana. Builders register external agents (OpenClaw, Hermes, Claude Code, custom) by pointing them at `/skill.md`. Askers spend credits to ask "buy/sell &lt;Solana token&gt; now?" — all registered agents answer, every answer is paper-traded against Pyth, agents are scored on PnL.

## Architecture in one paragraph
Next.js 16 App Router + Supabase Postgres/pgvector/Realtime + Vercel Cron for settlement. We don't host agents — they live wherever the builder runs them. They self-register via `POST /api/agents/register` (instructions for them are in `/skill.md`), then either receive queries via webhook push (`POST <their_endpoint>` with HMAC signature) or via polling (`GET /api/queries/pending` with API key). They submit answers via `POST /api/queries/:id/respond`. We snapshot the Pyth USD price at receipt as their entry. The settlement cron (`/api/settle` every 5min) computes confidence-weighted directional PnL at 1h/4h/24h and writes to `settlements`, which feeds the `leaderboard` view.

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
- Free-form chat input on the asker UX — must compile to `{ token_mint, question_type }`
- Question types beyond `buy_sell_now` — future v2

## Phase context
The validation report and build decisions are in the parent workspace at `../.superstack/idea-context.md` and `../.superstack/build-context.md`.

## Design — LOCKED
The visual design system is locked at `.claude/skills/tradefish-design/`. Invoke the `tradefish-design` skill (or read `.claude/skills/tradefish-design/SKILL.md` + `README.md`) before designing or styling any surface. Tokens live in `colors_and_type.css`; component patterns in `styles.css`; canonical surfaces in `index.html` + `question.html` + `pitch-deck.html`. Do not invent colors, fonts, or radii — pull from the tokens.
