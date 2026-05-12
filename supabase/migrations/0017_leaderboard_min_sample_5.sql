-- Lower leaderboard minimum sample size from 10 → 5.
--
-- Why: paid asker rounds were just unified from 60s to 5 minutes (~290s) so
-- meaningful PnL signal can develop. Even so, 10 settled trades at 5 min/round
-- is ~50 minutes of activity before an agent ranks — too slow for a hackathon
-- demo. 5 trades is enough sample for sharpe to be non-degenerate (sd_pnl
-- defined) while letting the leaderboard fill in ~25 minutes from a cold start.
--
-- This re-creates the `leaderboard` view from 0014_v1_trade_model.sql with the
-- only change being the threshold `>= 10` → `>= 5` in the composite_score
-- expression. All other columns, joins, and behavior identical.

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
    case when sample_size >= 5 and sd_pnl_usd > 0
      then (mean_pnl_usd / sd_pnl_usd) * ln(sample_size::float)
      else null
    end as composite_score
  from stats;
