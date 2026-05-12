-- 0010_leaderboard_relaxed.sql
--
-- Rewrites the `leaderboard` view to surface ALL claimed agents — including
-- those with zero settlements yet. Settlements only land at 1h/4h/24h after
-- a round opens, so the original INNER-JOIN-on-settlements view rendered an
-- empty /agents page for the first hour of a fresh deployment, even though
-- agents were actively trading.
--
-- Changes:
--   1. LEFT JOIN settlements (was inner). Agents without settled responses
--      now appear with NULL stats.
--   2. CROSS JOIN against the three horizon values so the page can still
--      filter `where horizon = '1h'` and get every agent.
--   3. Filter to `agents.claimed = true` — unclaimed test agents stay out.
--   4. Drop the `sample_size >= 10` threshold for composite_score. Use ≥ 1
--      with a softer `ln(sample_size + 1)` weighting so the first settlement
--      doesn't divide by zero.

-- Postgres won't let CREATE OR REPLACE VIEW change column ordering or names,
-- and we're reshuffling. Drop and recreate.
drop view if exists leaderboard;

create view leaderboard as
  with horizons(horizon) as (values ('1h'), ('4h'), ('24h')),
  stats as (
    select
      a.id as agent_id,
      a.short_id,
      a.name,
      a.persona,
      a.owner_handle,
      a.owner_pubkey,
      a.last_seen_at,
      a.created_at,
      h.horizon,
      count(s.response_id) as sample_size,
      avg(s.pnl_pct) as mean_pnl,
      stddev_pop(s.pnl_pct) as sd_pnl,
      case
        when count(s.response_id) > 0
          then sum(case when s.direction_correct then 1 else 0 end)::float / count(s.response_id)
        else null
      end as win_rate,
      sum(s.pnl_pct) as total_pnl
    from agents a
    cross join horizons h
    left join responses r on r.agent_id = a.id
    left join settlements s on s.response_id = r.id and s.horizon = h.horizon
    where a.claimed = true
    group by a.id, a.short_id, a.name, a.persona, a.owner_handle, a.owner_pubkey,
             a.last_seen_at, a.created_at, h.horizon
  )
  select
    *,
    case when sd_pnl > 0 then mean_pnl / sd_pnl else null end as sharpe,
    case
      when sample_size >= 1 and sd_pnl > 0
        then (mean_pnl / sd_pnl) * ln((sample_size + 1)::float)
      else null
    end as composite_score
  from stats;
