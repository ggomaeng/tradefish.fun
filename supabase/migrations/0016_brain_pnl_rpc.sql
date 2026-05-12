-- 0016_brain_pnl_rpc.sql
--
-- Defines brain_accrue_pnl(response_id) — the citation-pair PnL accrual RPC
-- called by the settle cron at src/app/api/settle/route.ts after each
-- paper_trades insert. Reads paper_trades.pnl_usd (real leveraged USD)
-- keyed by response_id and propagates it into the brain graph:
--   - wiki_entries.pnl_attributed_usd += abs(pnl_usd) * weight    (per cited slug)
--   - note_edges.pnl_flow_usd        += abs(pnl_usd) * min(weights) (per pair)
--   - note_edges.co_cite_count       += 1                         (per pair)
--
-- Lands after 0014_v1_trade_model.sql (creates paper_trades, drops settlements)
-- and 0015_agent_revivals.sql. plpgsql late-binds table references, so the
-- CREATE OR REPLACE itself is safe even if applied before 0014 — only on call
-- would it error.
--
-- abs(pnl) by design: edges encode knowledge-usage intensity, not directional
-- outcome. Signed pnl would cancel out across balanced right/wrong calls and
-- destroy the co-citation signal. Per-note directional performance is captured
-- elsewhere (responses → paper_trades).
--
-- Comments-as-trades: this RPC remains response-only. Per the handoff Option A,
-- comment-trades are excluded from brain accrual (they aren't a citation
-- surface). If that changes, add a sibling brain_accrue_pnl_comment(comment_id).

create or replace function brain_accrue_pnl(p_response_id uuid)
returns void
language plpgsql
as $$
declare
  v_pnl_usd    numeric;
  v_pnl_abs    numeric;
  v_from_slug  text;
  v_to_slug    text;
  v_w_a        numeric;
  v_w_b        numeric;
begin
  -- ── Look up the leveraged USD PnL for this response from paper_trades ───────
  select pnl_usd into v_pnl_usd
  from paper_trades
  where response_id = p_response_id
  limit 1;

  -- If the trade hasn't settled yet, or pnl is exactly zero, nothing to attribute.
  if v_pnl_usd is null or v_pnl_usd = 0 then
    return;
  end if;

  v_pnl_abs := abs(v_pnl_usd);

  -- ── Per-slug attribution (wiki_entries.pnl_attributed_usd) ─────────────────
  -- Edges and per-note attribution use abs(pnl) — they represent knowledge-usage
  -- intensity, not directional outcome. Signed pnl would cancel out across
  -- balanced right/wrong calls and destroy the co-citation signal.
  update wiki_entries we
  set pnl_attributed_usd = pnl_attributed_usd + (v_pnl_abs * ac.weight)
  from answer_citations ac
  where ac.answer_id = p_response_id
    and ac.slug = we.slug;

  -- ── Pairwise edge accrual (note_edges) ──────────────────────────────────────
  for v_from_slug, v_to_slug, v_w_a, v_w_b in
    select
      least(a.slug, b.slug)    as from_slug,
      greatest(a.slug, b.slug) as to_slug,
      case when a.slug < b.slug then a.weight else b.weight end as w_a,
      case when a.slug < b.slug then b.weight else a.weight end as w_b
    from answer_citations a
    join answer_citations b
      on a.answer_id = b.answer_id
      and a.slug <> b.slug
      and a.slug < b.slug
    where a.answer_id = p_response_id
  loop
    insert into note_edges (from_slug, to_slug, similarity, co_cite_count, pnl_flow_usd, updated_at)
    values (
      v_from_slug,
      v_to_slug,
      0,
      1,
      v_pnl_abs * least(v_w_a, v_w_b),
      now()
    )
    on conflict (from_slug, to_slug) do update
      set pnl_flow_usd  = note_edges.pnl_flow_usd  + excluded.pnl_flow_usd,
          co_cite_count = note_edges.co_cite_count + 1,
          updated_at    = now();
  end loop;
end;
$$;
