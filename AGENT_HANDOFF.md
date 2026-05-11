# TradeFish — Agent Handoff (post-waitlist platform v1)

> **Read this first** when entering a fresh Claude Code session in this worktree.
> Last updated: 2026-05-09 by an autonomous orchestrator session.
> Branch: `feat/post-waitlist`. HEAD: see `git log -1 --oneline`.

## What this is

**TradeFish** — a live arena for AI trading agents on Solana (`tradefish.fun`). The Solana hackathon's monetization criterion drives the design: real on-chain SOL payments for question credits.

- **Spectators** watch `/arena`. No wallet needed.
- **Askers** connect Phantom → top up SOL → spend 10 credits per question.
- **Agents** self-register by reading `/skill.md` (the canonical contract). The platform is a contract, not a sign-up form. Owners take ownership of their agent by signing a message with their Solana wallet at the `claim_url`.
- **Settlement** at 1h / 4h / 24h via Pyth Hermes; PnL becomes leaderboard score.

## Locked mental model — do NOT deviate

1. **Agents register themselves via `/skill.md`** (like v1 / moltbook.com). No HTML form for human agent registration.
2. **Humans only need a Solana wallet** — the same wallet pays for credits AND claims agent ownership. No email, no X/Twitter verification, no separate sign-up form.
3. **Wallet pubkey IS the human's identity.** `agents.owner_pubkey` is the source of truth for ownership; `agents.owner_handle` is now nullable cosmetic display only.
4. **No seeded data.** First registered agent populates the arena. Empty states are honest.
5. **Devnet only** for the demo's payment flow. Treasury: `GigzG9cDT2kamQRtkt6Njm4hXr2EFGRsL1NAGQ7RagSk`.
6. **v2 design system is locked (2026-05-09 reset).** Source of truth: `src/app/globals.css` + `.claude/skills/tradefish-design/index.html` (mockup) + `SKILL.md` / `README.md` (rules). Direction: claude.ai calm + codex precision + pump.fun cleanness. Inter sans + JetBrains Mono numerics on near-pure-black `#0A0A0B`. Cyan brand `#5EEAF0`. Solana gradient `#9945FF → #14F195` used at most once per surface. LONG=mint `#14F195`, SHORT=red `#FF4D6D`, HOLD=amber `#FFB347`, LIVE=cyan. Round corners (4/6/8/12). No box-drawing, no scanlines, no Departure Mono.

## Current state (✅ done)

### Foundation
- v2 design system applied to all platform pages (refactored from v1 cool-black ocean palette)
- `(platform)` route group with shared top-nav (HOME / ARENA / ASK / AGENTS / REGISTER / DOCS + WalletWidget + OPEN ROUND CTA)
- Root `layout.tsx` untouched (waitlist owns it)
- `globals.css` with thin component layer: `.tf-card`, `.tf-term`, `.tf-cta`, `.tf-eyebrow`, `.t-spectrum`, `.tf-chip`, etc.

### Solana payments (the monetization story)
- Migration `0004_credits.sql`: `wallet_credits` + `topups` tables (idempotent on signature)
- `<SolanaProvider>` (Phantom + Solflare adapters, devnet RPC) wraps `(platform)/layout.tsx`
- `<WalletWidget>` in nav: connect / pubkey chip / credits / disconnect
- `<TopupModal>`: builds `SystemProgram.transfer(0.01 SOL → treasury)`, signs via wallet adapter, awaits confirmation, posts signature to backend
- `POST /api/credits/topup`: parsed-tx verification via `Connection.getParsedTransaction`, walks instructions for matching transfer, idempotent on UNIQUE(signature), credits added = `floor(lamports / 1_000_000)` (10M lamports = 10 credits)
- `GET /api/credits/balance?wallet=…`
- `POST /api/queries` requires `X-Wallet-Pubkey` header (401 otherwise), atomic 10-credit debit via `where credits >= 10` clause, refund on Pyth/insert failure
- **Pricing locked**: 0.01 SOL = 10 credits = 1 standard `buy_sell_now` question

### Wallet-only auth
- Migration `0005_owner_pubkey.sql`: `agents.owner_handle` nullable, `agents.owner_pubkey text` + index, `agents.claimed_at timestamptz`
- `POST /api/agents/[id]/claim`: body `{ token, wallet_pubkey, signature?, demo? }`. Verifies `nacl.sign.detached.verify(messageBytes, bs58.decode(signature), bs58.decode(wallet_pubkey))` against the canonical message `tradefish:claim:<token>:<short_id>`. Sets `claimed=true, owner_pubkey, claimed_at`.
- `GET /api/agents/[id]`: public agent state lookup (used by claim flow)
- `/claim/[token]/ClaimClient.tsx`: full state machine (loading / missing_agent / not_found / already_claimed / unclaimed_no_wallet / unclaimed_ready / signing / verifying / success / error). Two paths: ▸ SIGN & CLAIM (real signature) and ▸ DEMO CLAIM (hackathon bypass — no signature, just records the wallet as owner)
- `/agents/register/page.tsx`: docs-only page (no form). 3 sections: ① "Tell your AI agent" prompt, ② curl example, ③ explanation of claim flow. Form-based registration was deliberately removed.
- `/api/agents/register`: `owner_handle` is now optional

### Live arena (real Supabase data, no mocks)
- Canvas wired to Supabase Realtime via `useArenaSwarm` hook (`src/lib/realtime/arena.ts`). Subscribes to INSERTs on `responses` + `settlements`. Live / idle / empty states.
- `LiveActivity.tsx`: `useArenaActivity` hook tails events (predicts + settles + claims). Real Supabase channels.
- `LiveStats.tsx`: async server component, `revalidate=10`, real counts from Supabase

### Agent dashboard
- `/agents/[id]/page.tsx`: reads `?just_registered=1` and `?just_claimed=1` for one-time banners
- `<OwnerControls>` subcomponent: owner detected via `useWallet().publicKey === agent.owner_pubkey`. If matches: shows ONBOARDING PROMPT copy block + SEND TEST QUERY CTA + webhook info. Hidden for non-owners.

### Trade-wiki (vector search)
- Migration `0003_wiki_match.sql`: `match_wiki(query_embedding, match_count, match_threshold)` RPC
- `scripts/embed-wiki.ts`: ingest script (text-embedding-3-small via OpenAI). Run with `OPENAI_API_KEY` set: `npm run embed:wiki`.
- `lib/wiki/search.ts`: pgvector cosine similarity via RPC, **falls back to keyword search** if `OPENAI_API_KEY` unset or RPC fails — so the route works in offline dev or pre-ingest.

### Tests
- `vitest`: 43 tests on `lib/settlement.ts` covering direction × window × confidence × edges. All green. `npm test`.

## Staging URL

```
https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app
```

**Public (no Vercel auth)**. Stable per-branch alias — always serves latest `feat/post-waitlist` build. Production at `tradefish.fun` stays on `main` = waitlist until cutover.

## Vercel env (already configured)

| Var | Production | Preview (feat/post-waitlist) |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ |
| `NEXT_PUBLIC_SITE_URL` | ✅ (tradefish.fun) | ✅ (preview alias) |
| `NEXT_PUBLIC_SOLANA_RPC` | ✅ devnet | ✅ devnet |
| `NEXT_PUBLIC_TRADEFISH_TREASURY` | ✅ `Gigz…agSk` | ✅ `Gigz…agSk` |

### Optional env (not set; demo path works without these)
- `OPENAI_API_KEY` — wiki vector search; falls back to keyword
- `ANTHROPIC_API_KEY` — only for LLM reference agents (real users bring their own)
- `HELIUS_API_KEY` / `BIRDEYE_API_KEY` — `/api/tokens/[mint]/snapshot` enrichment; agents can still respond using Pyth alone
- `SETTLEMENT_CRON_SECRET` / `INTERNAL_WEBHOOK_HMAC_SECRET` — cron + webhook auth

## Migrations (Supabase prod)

```
0001_init.sql            ✓ applied  (core schema)
0002_waitlist.sql        ✓ applied  (waitlist signups)
0003_wiki_match.sql      ✓ applied  (pgvector RPC)
0004_credits.sql         ✓ applied  (wallet_credits + topups)
0005_owner_pubkey.sql    ✓ applied  (nullable owner_handle, +owner_pubkey, +claimed_at)
```

To apply future migrations: `supabase db push --linked -p "<password>"` (project already linked via `supabase link --project-ref vzmezxnfwuwmitdfmjkh`).

Connection workaround for ad-hoc `psql`: project is on Hobby plan → direct DB endpoint is IPv6-only. Use the Supabase CLI (`supabase db push`) or hit the Supabase SQL editor in the dashboard. The pooler URL on us-west-1 returns "Tenant or user not found" for this project for unknown reasons.

## Treasury keypair (devnet, demo)

- Pubkey: `GigzG9cDT2kamQRtkt6Njm4hXr2EFGRsL1NAGQ7RagSk`
- Secret key (base64) backed up at `~/Documents/tradefish-supabase-credentials.txt`
- Reconstruct via `Keypair.fromSecretKey(Buffer.from(<secret>, "base64"))`

## DON'T-touch list (waitlist surface — owned by parallel session on `main`)

```
src/app/page.tsx                          (waitlist landing)
src/app/layout.tsx                        (root metadata + Departure Mono)
src/app/opengraph-image.tsx               (live OG image)
src/app/api/waitlist/route.ts
src/components/WaitlistForm.tsx
src/components/HeroSwarm.tsx
src/components/LightRays.tsx
supabase/migrations/0002_waitlist.sql
public/logo.png
public/fonts/DepartureMono-Regular.woff2
src/app/DepartureMono-Regular.otf
src/app/logo-og.png
```

## Demo flow (end-to-end on staging)

1. **Spectator** opens `/arena` → live Canvas (idle until first agent registers + answers a real query)
2. **Builder** tells their AI agent (Claude Code, OpenClaw, custom): *"Read https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app/skill.md and register on TradeFish."*
3. Agent self-registers via `POST /api/agents/register` → returns `{ agent_id, api_key, claim_url, webhook_secret? }` → reports `claim_url` to its owner
4. **Owner** visits `claim_url`, connects Phantom (devnet), clicks **▸ SIGN & CLAIM** → `signMessage("tradefish:claim:<token>:<short_id>")` → POST → backend verifies sig → `agents.owner_pubkey` written → redirects to `/agents/<short_id>?just_claimed=1`
5. **Asker** opens `/ask`, clicks **▸ CONNECT WALLET TO ASK** → Phantom prompt → balance shows 0 → click wallet chip → **▸ SIGN & SEND** in TopupModal → 0.01 SOL devnet transfer to treasury → `/api/credits/topup` verifies parsed tx → balance jumps to 10
6. Asker picks a token (BONK / SOL / JUP / WIF / etc.), **▸ OPEN ROUND** → atomic 10-credit debit → round opens with Pyth snapshot at receipt
7. Real agents poll `/api/queries/pending`, decide, POST `/api/queries/[id]/respond` → Canvas + LiveActivity reflect responses live via Supabase Realtime channels
8. Settlement at 1h/4h/24h via Pyth (cron in `vercel.json`; needs `SETTLEMENT_CRON_SECRET` set on production)

## Production cutover (when ready)

```bash
# In the OTHER worktree (parallel session owns):
cd /Users/ggoma/Projects/hackathons/solana.new/tradefish
git fetch origin
gh pr create --base main --head feat/post-waitlist \
  --title "Platform v1: live arena + Solana payments + agent registration" \
  --body "…"
# Parallel session reviews the waitlist→platform swap, merges to main, Vercel auto-deploys to tradefish.fun.
```

Note: when production cuts over, the waitlist `page.tsx` on `main` will be replaced. The parallel session must coordinate. Current state: `feat/post-waitlist`'s `page.tsx` IS the waitlist (untouched on this branch). After merge, all routes resolve under `(platform)/` group at the same URLs they had on the v1 scaffold.

## File map (what lives where)

```
src/app/
  page.tsx                               waitlist (DON'T TOUCH)
  layout.tsx                             root meta + Departure Mono (DON'T TOUCH)
  opengraph-image.tsx                    live OG (DON'T TOUCH)
  globals.css                            v2 tokens + thin component layer
  skill.md/route.ts                      serves src/content/skill.md
  (platform)/
    layout.tsx                           SolanaProvider wrap + shared nav + WalletWidget
    arena/page.tsx                       Canvas + LiveActivity + LiveStats
    ask/page.tsx                         QueryComposer
    agents/page.tsx                      leaderboard
    agents/register/page.tsx             docs-only registration page
    agents/[id]/page.tsx                 dashboard + OwnerControls
    agents/[id]/OwnerControls.tsx        wallet-aware affordances
    round/[id]/page.tsx                  qhead + bar + timeline of responses
    docs/page.tsx                        skill.md mirror
    claim/[token]/page.tsx               server shell
    claim/[token]/ClaimClient.tsx        wallet-signature claim state machine
  api/
    agents/register/route.ts             owner_handle optional
    agents/[id]/route.ts                 GET public state
    agents/[id]/claim/route.ts           wallet-signature verify + record owner_pubkey
    agents/[id]/scorecard/route.ts       performance per window
    credits/balance/route.ts
    credits/topup/route.ts               parsed-tx verification
    queries/route.ts                     wallet-required, atomic debit
    queries/[id]/respond/route.ts
    queries/pending/route.ts
    tokens/[mint]/snapshot/route.ts      Pyth + Jupiter + Birdeye + Helius
    wiki/search/route.ts                 pgvector with keyword fallback
    settle/route.ts                      Vercel cron at 1h/4h/24h
    internal/dispatch/route.ts           webhook fan-out
    waitlist/route.ts                    (DON'T TOUCH)

src/components/
  arena/{Canvas,AgentNode,LiveActivity,LiveStats}.tsx
  query/QueryComposer.tsx                wallet-required submit
  wallet/{SolanaProvider,WalletWidget,TopupModal}.tsx
  WaitlistForm,HeroSwarm,LightRays.tsx   (DON'T TOUCH)

src/lib/
  realtime/arena.ts                      useArenaSwarm hook
  realtime/activity.ts                   useArenaActivity hook
  wiki/search.ts                         pgvector + keyword fallback
  settlement.ts                          confidence-weighted directional PnL (43 tests green)
  clients/{pyth,jupiter,birdeye,helius}.ts
  db.ts                                  dbAdmin + dbBrowser (Supabase clients)
  apikey.ts, supported-tokens.ts, utils.ts

src/content/
  skill.md                               THE PRODUCT — agent contract
  wiki/*.md                              5 trade-wiki entries (pre-pgvector)

scripts/
  embed-wiki.ts                          OpenAI ingest → wiki_entries.embedding

supabase/migrations/
  0001_init.sql, 0002_waitlist.sql, 0003_wiki_match.sql, 0004_credits.sql, 0005_owner_pubkey.sql

examples/reference-agents/
  README.md                              for builders who want a starting point
  claude-momentum/                       scaffold-era reference; we don't run it for the demo
```

## What's NOT done (deliberate or low-priority)

- **No reference agents we run.** Real users register their own. The hackathon judge will literally try the registration flow.
- **No seeded data.** Empty arena until first agent + first round.
- **Settlement cron not auth'd.** Requires `SETTLEMENT_CRON_SECRET` on prod env — hasn't been set. Without it, settlement endpoint is open. For staging-day demo this is fine; before public production, set it.
- **Webhook dispatch lacks per-agent secret.** v1 signs with platform-wide HMAC. v2 should encrypt webhook_secret at rest so we can per-agent-sign. Documented in `internal/dispatch/route.ts`.
- **Twitter claim verification is a stub.** The wallet-signature path is the real flow; the X-tweet path was removed. (We never implemented Twitter API verification.)

## Critical Next.js 16 quirks already handled (don't undo)

- `params` and `searchParams` are Promises — `await` them
- `RouteContext<'/route/[id]'>` and `PageProps<'/route/[id]'>` are global type helpers
- `_`-prefixed folders are PRIVATE — we use `internal/` (gated by `INTERNAL_WEBHOOK_HMAC_SECRET`)
- `ssr: false` is FORBIDDEN in server components — `"use client"` files import directly
- `helius-sdk` v2 uses `createHelius({ apiKey })`, NOT `new Helius()`
- Vercel framework is `nextjs` at the project level — don't add `buildCommand` overrides
- Tailwind v4 uses `@theme inline` directive in `globals.css`

## Build verification commands

```bash
cd /Users/ggoma/Projects/hackathons/solana.new/tradefish-platform
npx tsc --noEmit         # must exit 0
npm run build            # must exit 0; expect 10 pages + 14 API routes
npm test                 # 43 vitest tests; all green
```
