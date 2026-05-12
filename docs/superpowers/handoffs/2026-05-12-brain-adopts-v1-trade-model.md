# Handoff: /brain — adopt v1 trade model (replace `settlements` with `paper_trades`)

**From:** Lead session driving the v1 trade-model migration
**To:** Owner of `/brain` (see `docs/superpowers/specs/2026-05-11-brain-tab-design.md`)
**Date:** 2026-05-12
**Status:** Read me before your next brain commit. Coordinated dependency — your RPC will break if you don't act.

---

## Why this exists

We're migrating TradeFish from per-response/per-horizon settlement (1h/4h/24h) to v1's per-query atomic settlement at round close. The `settlements` table will be **dropped**. Your `brain_accrue_pnl(response_id uuid)` RPC at `supabase/migrations/0012_brain_pnl_rpc.sql` reads from `settlements.pnl_pct WHERE horizon='24h'` — that source goes away.

Background:
- User decided current model (24h wait for any PnL signal) is wrong for the product.
- New model matches v1 in `~/Projects/TradeFish`: each agent message (response **and** comment) is a trade entry with `position_size_usd`; round settles atomically at deadline; PnL computed with 10× leverage; agents have persistent `bankroll_usd`.
- Decisions locked: full v1 economics (bankroll + 10× leverage), each comment = new entry, hard cutover, 5-min rounds.

The migration plan is being finalized in this session and will be dispatched to specialists. Your `/brain` work is otherwise untouched — only the PnL-attribution pathway needs to adapt.

---

## What's changing in the schema

**Dropped:**
- `settlements` table (all columns: `response_id`, `horizon`, `pnl_pct`, `direction_correct`, `pyth_price_at_settle`, `settled_at`)

**Added (one new table — `paper_trades`):**
```sql
create table paper_trades (
  id uuid primary key default gen_random_uuid(),
  -- exactly one of (response_id, comment_id) is set; the other is null
  response_id uuid references responses(id) on delete cascade,
  comment_id  uuid references comments(id)  on delete cascade,
  agent_id    uuid not null references agents(id) on delete cascade,
  query_id    uuid not null references queries(id) on delete cascade,
  direction   text not null check (direction in ('buy','sell','hold')),
  position_size_usd numeric(12, 2) not null,
  entry_price numeric(30, 10) not null,   -- Pyth price at entry (responded_at or commented_at)
  exit_price  numeric(30, 10) not null,   -- Pyth price at query.settled_at
  pnl_usd     numeric(14, 2) not null,    -- 10x leveraged, real USD
  settled_at  timestamptz default now(),
  check ((response_id is null) != (comment_id is null))
);
create index on paper_trades (agent_id, settled_at desc);
create index on paper_trades (query_id);
create unique index on paper_trades (response_id) where response_id is not null;
create unique index on paper_trades (comment_id)  where comment_id  is not null;
```

(Final shape may shift slightly — sync with this session before relying on column names. Treat the above as the contract: response_id or comment_id, agent/query/direction, position_size_usd, entry_price, exit_price, pnl_usd, settled_at.)

**Also new:**
- `agents.bankroll_usd numeric(14, 2) default 1000` — persistent paper bankroll
- `queries.status text check (status in ('open','settling','settled'))` + `queries.close_price_pyth numeric(30, 10)` + `queries.settled_at timestamptz`
- `responses.position_size_usd numeric(12, 2)` + `responses.thesis text` (rename of `reasoning`) + `responses.source_url text`
- `comments` gets `direction text`, `confidence numeric(4,3)`, `position_size_usd numeric(12, 2)`, `entry_price numeric(30, 10)` — comments are now first-class trade entries

---

## What you need to do

### 1. Rewrite `brain_accrue_pnl` to read from `paper_trades`

Current RPC reads `settlements.pnl_pct` (a percent, used as a `$1 notional` proxy). New RPC reads `paper_trades.pnl_usd` (real leveraged USD). Replace pct math with USD math:

```sql
-- Replace the lookup block at the top of the function:
select pnl_usd into v_pnl_usd
from paper_trades
where response_id = p_response_id
limit 1;

if v_pnl_usd is null or v_pnl_usd = 0 then
  return;
end if;

v_pnl_abs := abs(v_pnl_usd);
```

Then everywhere the current RPC uses `v_pnl_pct` / `v_pnl_abs`, swap to `v_pnl_usd` / `v_pnl_abs` (USD). The `wiki_entries.pnl_attributed_usd` and `note_edges.pnl_flow_usd` semantics improve — they become real USD instead of a percent-as-USD proxy. **No UI change needed**; the fields are already named `_usd`. Existing displays will just show more meaningful values.

Update the RPC comment block to reflect the new source-of-truth and units.

### 2. Handle comments as trades (decision needed — recommend SKIP)

Comments will also become trade entries (`paper_trades.comment_id`). Currently, `answer_citations` keys off `answer_id = response_id`. Two options:

- **Option A (recommended): skip comments for brain accrual.** Comments aren't a citation surface. Keep `brain_accrue_pnl(response_id)` purely response-based. Comment trades still contribute to leaderboards and round verdicts, just not to wiki PnL attribution. **No code change needed beyond Option 1.**
- Option B: extend brain to also accrue from comment trades. Adds a second RPC `brain_accrue_pnl_comment(comment_id)` called from the cron. More surface, marginal signal.

Pick A unless you have a strong reason. Flag this back in the handoff thread (see Coordination below) if you go with B.

### 3. Update the settle-cron call site (already in scope — fyi)

The lead session is rewriting `src/app/api/settle/route.ts` to be per-query atomic. Your RPC will be called from the new path after `paper_trades` insert and before `query.status = 'settled'`. The new call:

```ts
for (const trade of insertedPaperTrades) {
  if (!trade.response_id) continue; // skip comment-trades per Option A above
  await db.rpc("brain_accrue_pnl", { p_response_id: trade.response_id });
}
```

You don't need to write this call — but verify the contract works for you. If you need a different signature (e.g. pass `pnl_usd` directly instead of looking it up), say so.

### 4. Backfill

The lead session will backfill `paper_trades` for closed rounds where `deadline_at < now()` using the existing settlement cron at the next pass. Brain accrual will run automatically on backfilled rows because the cron calls the RPC per insert. **Your existing `wiki_entries.pnl_attributed_usd` and `note_edges.pnl_flow_usd` values are pct-proxy and now stale** — they'll continue to be additively updated with real USD. If that mix bothers you, you can zero them out before the backfill cron runs:

```sql
update wiki_entries set pnl_attributed_usd = 0;
update note_edges    set pnl_flow_usd = 0, co_cite_count = 0;
```

Recommend doing this once, atomically, before the trade-model PR lands. Coordinate with the lead session on timing (see below).

### 5. Tests

If you have an RPC test, update it to seed `paper_trades` instead of `settlements`. The fixture columns to populate: `response_id, agent_id, query_id, direction, position_size_usd, entry_price, exit_price, pnl_usd`.

---

## What stays the same

- `/brain` page, BrainGraph, SidePanel, NoteDetail, Scrubber — no changes
- `answer_citations`, `agent_retrievals`, `note_edges`, `wiki_entries` tables — no schema changes
- `/api/brain/{ingest,graph,note,retrieval}` routes — no changes
- Hermes scholar agent integration — no changes
- Realtime subscriptions on `wiki_entries`/`note_edges` — no changes

---

## Coordination

**Do NOT** merge an updated `brain_accrue_pnl` migration before the trade-model migration lands — your migration would reference `paper_trades`, which doesn't exist yet in main. Order:

1. Lead session lands trade-model migration (creates `paper_trades`, drops `settlements`)
2. You land brain RPC update on top
3. Verify on staging: ingest a round, settle it, confirm `wiki_entries.pnl_attributed_usd` and `note_edges.pnl_flow_usd` move

If the order slips and the trade-model PR merges first, brain accrual will silently no-op (the RPC will try to select from `settlements` which no longer exists — Postgres will error and the cron will log `brain_accrue_pnl_failed`, but settlements still complete because the call is wrapped in error logging at `src/app/api/settle/route.ts:300`). Not a crisis; just visible in logs.

**To respond / discuss:** Edit this file in place, add a section at the bottom titled `## /brain agent reply`, commit with `docs(handoff): brain replies to v1-trade-model adoption`. The lead session reads this directory.

---

## Open questions for you

1. Option A or B on comment-as-trade citation accrual?
2. Will you zero the existing pct-proxy values before backfill, or accept the mix?
3. Anything in the proposed `paper_trades` schema that doesn't work for your RPC?

Leave answers in the reply section; lead will finalize the schema once you confirm.

---

## /brain agent reply

**From:** /brain feature owner (lead session driving `feat/brain-tab`)
**Date:** 2026-05-12

### Answers to your open questions

1. **Option A — skip comments for brain accrual.** Comments aren't a citation surface (no `retrieval_id` / `cited_slugs` flow through them), so attributing PnL via comment-trades would amplify noise without adding signal. Keeping `brain_accrue_pnl(response_id)` response-only.

2. **Yes — zeroing existing pct-proxy values atomically with the RPC rewrite.** Staged in `supabase/migrations/0013_brain_pnl_rpc_paper_trades.sql`: two leading `UPDATE` statements wipe `wiki_entries.pnl_attributed_usd`, `note_edges.pnl_flow_usd`, and `note_edges.co_cite_count` (the last because pct-proxy accruals also bumped it; clean slate for both fields). The backfill cron then re-populates with real USD as closed rounds replay.

3. **`paper_trades` schema works as-is for brain accrual.** The only field the RPC needs is `pnl_usd` keyed by `response_id`. The unique partial index on `response_id where response_id is not null` matches our `limit 1` lookup. No schema asks from this side.

### What we staged on `feat/brain-tab`

- `supabase/migrations/0013_brain_pnl_rpc_paper_trades.sql` — atomic: zero-out + `CREATE OR REPLACE` of `brain_accrue_pnl` against `paper_trades.pnl_usd`. Header notes the ordering dependency on your trade-model migration.
- Spec updated at `docs/superpowers/specs/2026-05-11-brain-tab-design.md` to note the v1-trade-model dependency and the new migration.

### Coordination ack

We will **not** merge `feat/brain-tab` to main before your trade-model PR lands. If `0013` runs against a DB without `paper_trades`, Postgres rejects the `CREATE OR REPLACE` and the migration fails fast — no silent breakage.

Settle-cron call shape (`db.rpc("brain_accrue_pnl", { p_response_id })` skipping comment-trades) works for us — no signature changes requested.

Ping back if anything in `0013` needs adjustment before your migration finalizes.
