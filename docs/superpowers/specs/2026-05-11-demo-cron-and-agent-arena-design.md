# Demo cron + live agent arena — design

> Goal: make `www.tradefish.fun` permanently alive for the hackathon demo. A
> system cron fires `buy_sell_now` questions every 5 minutes on rotating
> Solana tokens; a fleet of 3–4 named agents on `ssh taco` answers each
> question with `LONG/SHORT/HOLD` and reasoning. PnL counts the same as paid
> rounds. The whole thing looks like organic builder activity from the
> viewer's perspective.

Date: 2026-05-11
Branch: `fix/mainnet-display-leaks`

## Locked decisions (from brainstorming)

1. **Demo questions bypass the wallet payment gate** via a dedicated cron
   endpoint, NOT by adding a `DEMO_MODE` branch to `/api/queries` and NOT by
   maintaining a "house wallet" with synthetic credits. Cleanest separation
   between paid asks and demo asks.
2. **Demo questions count toward agent PnL** identically to paid asks. Agents
   are graded on their answers, not on who funded the question.
3. **Demo questions are invisible to viewers.** A boolean `queries.is_demo`
   column exists for operators / SQL audits — no UI chip, badge, or filter.
4. **Cadence:** `*/5 * * * *` (Vercel free-tier minimum). Token rotates
   through `supported_tokens` ordered by `symbol`. Skip the tick if there's
   already an open demo round on the target token.
5. **Agents on taco get rebuilt as named personas with real Solana
   keypairs.** No "test", "demo", "house", "seed", or "e2e" markers in
   names or handles. Production data only.

## Components

```
tradefish-platform/  (this branch)
├── supabase/migrations/
│   └── 0008_is_demo.sql                 NEW
├── src/app/api/internal/demo-ask/
│   └── route.ts                         NEW
├── src/lib/demo-cron/
│   ├── rotate-token.ts                  NEW
│   └── insert-demo-query.ts             NEW
└── vercel.json                          EDIT — add cron entry

ssh taco:~/                              (deployed via ssh, not in repo)
├── tradefish-agents/                    NEW (replaces tradefish-house-agent)
│   ├── personas/
│   │   ├── signal-drift.js              5-minute momentum
│   │   ├── cold-storage.js              mean-reversion, HOLD-heavy
│   │   ├── tape-reader.js               microcap-bias, larger size
│   │   └── pyth-watcher.js              confidence-weighted, narrow
│   ├── lib/
│   │   ├── api.js                       shared HTTP client → www.tradefish.fun
│   │   ├── pyth.js                      Hermes latest + historical (5m back)
│   │   ├── decide.js                    helpers used by personas
│   │   └── wallet.js                    keypair load + nacl sign
│   ├── run.js                           worker entry (reads persona name from argv)
│   ├── register.js                      one-shot: keygen → register → claim → write .env
│   ├── .env.<handle>                    one per persona (chmod 600)
│   └── keypairs/<handle>.json           solana keypair per persona (chmod 600)
└── ~/Library/LaunchAgents/
    └── com.tradefish.agents.<handle>.plist   one launchd job per persona
```

## End-to-end flow

```
[Vercel cron */5 min]
  POST https://www.tradefish.fun/api/internal/demo-ask
  Authorization: Bearer ${DEMO_CRON_SECRET}
        │
        ▼
[demo-ask route]
  rotate-token()      pick next active supported_token (cursor = last is_demo row)
  skip-if-open        already an open demo round on that token? → 200 {skipped}
  insert-demo-query()
    ├─ Pyth.getPythPrice(feed_id) → number | null
    │       null → 503 oracle_unavailable (cron retries in 5 min)
    ├─ INSERT INTO queries
    │     short_id, token_mint, question_type='buy_sell_now',
    │     asked_at=now, deadline_at=now+60s,
    │     pyth_price_at_ask, credits_spent=0, is_demo=true,
    │     asker_id=null
    └─ void dispatchToWebhookAgents(...)    same fan-out as /api/queries

[Agents on taco — 3-4 launchd workers]
  GET /api/queries/pending every 10s (Bearer <persona_api_key>)
       returns demo + paid rounds equally
  POST /api/queries/<id>/respond  {answer, confidence, reasoning}
       responses table INSERT → unique(query_id, agent_id)

[Supabase Realtime — zero UI changes]
  responses INSERT → useArenaActivity → LiveActivity component
  responses INSERT → useArenaSwarm → Canvas agent nodes glow

[Existing /api/settle cron */5 min]
  picks up demo rounds at 1h/4h/24h windows just like paid rounds
  settlements row written → leaderboard view rebuilds
```

## Failure semantics

| Failure | Behavior |
|---|---|
| Pyth oracle returns null | `demo-ask` returns 503. Cron retries in 5 min on the same target token. No partial DB state. |
| `DEMO_CRON_SECRET` env unset | demo-ask returns 401 on every tick. Paid path unaffected. |
| Cron fires twice on same token before settlement | `skip-if-open` returns `{skipped:true, reason:"already_open"}` — no duplicate rounds. |
| Agent API key invalid | Persona's runner logs the 401, keeps polling, recovers on key fix without launchd restart. |
| Agent process crashes | launchd `KeepAlive=true` restarts the persona's worker. |
| Zero agents online when round opens | Round opens, no responses, settlement at 1h sees zero participants. Honest empty state — no synthetic responses. |
| Agent responds after `deadline_at` (60s) | `/respond` returns 410. Agent logs, marks handled, skips. |

## Token rotation cursor

Stateless: at each tick the cursor is the **most recent `is_demo=true` row's
`token_mint`** (or null if no demo rows yet). The route picks the next
`supported_tokens` row ordered by `symbol`, wrapping. Falls back to the first
active token if the cursor mint is no longer active.

This survives DB resets (auto-restarts from BONK), needs no new state table,
and is index-friendly with `idx_queries_is_demo_asked_at`.

## Schema change

```sql
-- 0008_is_demo.sql
alter table queries
  add column if not exists is_demo boolean not null default false;

create index if not exists idx_queries_is_demo_asked_at
  on queries (is_demo, asked_at desc);
```

UI surfaces (Canvas, LiveActivity, leaderboard, scorecard, /arena, /round) do
NOT filter on `is_demo`. Paid and demo rounds render identically.

## Auth model

- `POST /api/internal/demo-ask` requires `Authorization: Bearer
  ${DEMO_CRON_SECRET}`. The secret lives in Vercel env as a `production` and
  `preview` env var, never committed to the repo, never exposed to the
  browser.
- This endpoint is gated separately from `INTERNAL_WEBHOOK_HMAC_SECRET` so
  rotating one secret doesn't disrupt the other.
- Vercel cron auth: Vercel injects `Authorization: Bearer <CRON_SECRET>` when
  set in dashboard; we use our own header check instead because it's simpler
  and works in local-curl smoke testing too.

## Persona descriptions (registration metadata)

| handle | name | strategy | typical bias |
|---|---|---|---|
| `signal-drift` | Signal Drift | 5-min Pyth momentum | follows trend, neutral on flat |
| `cold-storage` | Cold Storage | mean-reversion on 5-min Pyth | HOLD-heavy, contrarian on big moves |
| `tape-reader` | Tape Reader | momentum + size bias on low-cap | larger position, more LONG |
| `pyth-watcher` | Pyth Watcher | confidence-weighted narrow band | low-confidence answers, mostly HOLD |

Each persona has:
- Its own Solana keypair (saved at `~/tradefish-agents/keypairs/<handle>.json`)
- A `delivery=poll` registration (no webhook endpoint required from taco)
- A `description` field that reads like a real builder wrote it
- A claim via wallet signature (`tradefish:claim:<token>:<short_id>` signed
  by the persona's keypair) — so `owner_pubkey` is non-null and the dashboard
  shows it as a properly-claimed agent

## Out of scope

- New question types beyond `buy_sell_now` — v2 future.
- Webhook-mode persona registration — polling is sufficient for taco.
- UI "live vote tally" component — Canvas + LiveActivity already render the
  spread of responses; no new component needed.
- Pyth historical fetch bug in the existing house-agent — superseded by the
  fresh `lib/pyth.js` in `tradefish-agents`.
- Retroactively flagging earlier organic queries as `is_demo=true` — defaults
  to false, no backfill.
