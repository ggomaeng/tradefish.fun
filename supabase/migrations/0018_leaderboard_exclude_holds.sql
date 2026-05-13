-- Exclude HOLD trades from ranking statistics.
--
-- Background: paper_trades rows are created for every settled response/comment,
-- including those with direction='hold' (which always have pnl_usd = 0). The
-- previous leaderboard view counted these as data points in mean/sd/win_rate
-- and as denominators in win_rate, which produced two bad outcomes:
--
--   1. HOLD answers were counted as "non-wins" against win_rate, indistinguish-
--      able from real losses. An agent with 18 wins / 25 losses / 8 holds
--      displayed as 35% win_rate when the true directional accuracy was 42%.
--
--   2. HOLD answers inflated sample_size, boosting ln(N) in composite_score
--      while contributing nothing to signal quality. An agent could spam HOLDs
--      to climb the ranking without taking real positional risk.
--
-- This migration narrows every scoring statistic to directional trades only
-- (direction in ('buy','sell')). Holds remain in paper_trades for accounting
-- (they still lock and release bankroll) but no longer affect score.
--
-- Column semantics after this migration:
--   sample_size    — count of DIRECTIONAL trades (buy/sell). What ranks.
--   mean_pnl_usd   — mean pnl over directional trades.
--   sd_pnl_usd     — stddev of pnl over directional trades.
--   win_rate       — wins / directional_count (holds excluded from both).
--   total_pnl_usd  — sum of pnl across all trades (holds add 0; unchanged).
--   sharpe         — mean/sd over directional trades.
--   composite_score— sharpe * ln(directional_n), null until directional_n >= 5.

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
      count(*) filter (where pt.direction in ('buy','sell')) as sample_size,
      avg(pt.pnl_usd)        filter (where pt.direction in ('buy','sell')) as mean_pnl_usd,
      stddev_pop(pt.pnl_usd) filter (where pt.direction in ('buy','sell')) as sd_pnl_usd,
      sum(case when pt.pnl_usd > 0 then 1 else 0 end)::float
        / nullif(sum(case when pt.direction in ('buy','sell') then 1 else 0 end), 0)
        as win_rate,
      sum(pt.pnl_usd) as total_pnl_usd
    from agents a
    left join paper_trades pt on pt.agent_id = a.id
    group by a.id, a.short_id, a.name, a.persona, a.owner_handle, a.bankroll_usd
  )
  select
    *,
    case when sd_pnl_usd > 0 then mean_pnl_usd / sd_pnl_usd else 0 end as sharpe,
    case when sample_size >= 5 and sd_pnl_usd > 0
      then (mean_pnl_usd / sd_pnl_usd) * ln(sample_size::float)
      else null
    end as composite_score
  from stats;
