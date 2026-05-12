-- 0014_v1_trade_model.sql
-- Migrate from per-horizon settlements to v1's per-query atomic settlement model.
-- Each agent message (response + comment) becomes a trade entry with persistent bankroll.

-- ── 1. Drop the old per-horizon settlements table ──────────────────
-- Currently empty in prod; cascade drop is safe.
drop table if exists settlements cascade;

-- ── 2. Persistent paper bankroll on agents ─────────────────────────
alter table agents add column if not exists bankroll_usd numeric(14, 2) not null default 1000;

-- ── 3. Round lifecycle on queries ──────────────────────────────────
alter table queries add column if not exists status text not null default 'open'
  check (status in ('open', 'settling', 'settled'));
alter table queries add column if not exists close_price_pyth numeric(30, 10);
alter table queries add column if not exists settled_at timestamptz;

create index if not exists idx_queries_status_deadline on queries (status, deadline_at);

-- ── 4. Trade-entry fields on responses ─────────────────────────────
alter table responses add column if not exists position_size_usd numeric(12, 2) not null default 100;
alter table responses add column if not exists source_url text;

-- ── 5. Promote comments to first-class trade entries ───────────────
alter table comments add column if not exists direction text
  check (direction in ('buy', 'sell', 'hold'));
alter table comments add column if not exists confidence numeric(4, 3)
  check (confidence >= 0 and confidence <= 1);
alter table comments add column if not exists position_size_usd numeric(12, 2);
alter table comments add column if not exists entry_price numeric(30, 10);

-- ── 6. Paper trades (settlement records, 1:1 with response OR comment) ──
create table if not exists paper_trades (
  id uuid primary key default gen_random_uuid(),
  response_id uuid references responses(id) on delete cascade,
  comment_id  uuid references comments(id)  on delete cascade,
  agent_id    uuid not null references agents(id) on delete cascade,
  query_id    uuid not null references queries(id) on delete cascade,
  direction   text not null check (direction in ('buy','sell','hold')),
  position_size_usd numeric(12, 2) not null,
  entry_price numeric(30, 10) not null,
  exit_price  numeric(30, 10) not null,
  pnl_usd     numeric(14, 2) not null,
  settled_at  timestamptz default now(),
  check ((response_id is null) != (comment_id is null))
);
create unique index if not exists uq_paper_trades_response on paper_trades (response_id) where response_id is not null;
create unique index if not exists uq_paper_trades_comment  on paper_trades (comment_id)  where comment_id  is not null;
create index if not exists idx_paper_trades_agent_at on paper_trades (agent_id, settled_at desc);
create index if not exists idx_paper_trades_query    on paper_trades (query_id);

-- ── 7. Rewrite leaderboard view ────────────────────────────────────
drop view if exists leaderboard;
create or replace view leaderboard as
  with stats as (
    select
      a.id as agent_id,
      a.short_id,
      a.name,
      a.persona,
      a.owner_handle,
      a.bankroll_usd,
      count(pt.*) as sample_size,
      avg(pt.pnl_usd)        as mean_pnl_usd,
      stddev_pop(pt.pnl_usd) as sd_pnl_usd,
      sum(case when pt.pnl_usd > 0 then 1 else 0 end)::float / nullif(count(pt.*), 0) as win_rate,
      sum(pt.pnl_usd) as total_pnl_usd
    from agents a
    left join paper_trades pt on pt.agent_id = a.id
    group by a.id, a.short_id, a.name, a.persona, a.owner_handle, a.bankroll_usd
  )
  select
    *,
    case when sd_pnl_usd > 0 then mean_pnl_usd / sd_pnl_usd else 0 end as sharpe,
    case when sample_size >= 10 and sd_pnl_usd > 0
      then (mean_pnl_usd / sd_pnl_usd) * ln(sample_size::float)
      else null
    end as composite_score
  from stats;

-- ── 8. Backfill: mark already-closed queries as settled ────────────
-- For any query whose deadline has passed at migration time, mark status='settled'
-- so the cron doesn't try to retroactively settle them without proper exit prices.
update queries set status = 'settled', settled_at = deadline_at
  where deadline_at < now() and status = 'open';

-- ── 9. Realtime publication ───────────────────────────────────────
-- Replace settlements channel with paper_trades.
-- Note: ALTER PUBLICATION ... DROP TABLE IF EXISTS is not valid SQL;
-- use a DO block to conditionally remove settlements (which may already
-- have been auto-removed when the table was dropped in step 1).
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'settlements'
  ) then
    alter publication supabase_realtime drop table settlements;
  end if;
end
$$;
alter publication supabase_realtime add table paper_trades;
