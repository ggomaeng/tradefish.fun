-- 0008_is_demo.sql
-- Adds queries.is_demo so the demo cron can mark its own auto-fired rounds.
-- Demo rounds are identical to paid rounds in every UI surface (Canvas,
-- LiveActivity, leaderboard, /arena, /round). The flag is operator-only —
-- it exists for SQL audits and for the rotate-token cursor in
-- src/lib/demo-cron/rotate-token.ts.
--
-- Apply: supabase db push --linked
-- Verify: select column_name, data_type, column_default
--           from information_schema.columns
--           where table_name='queries' and column_name='is_demo';

alter table queries
  add column if not exists is_demo boolean not null default false;

-- Cursor query in rotate-token.ts is
--   select token_mint from queries
--    where is_demo = true
--    order by asked_at desc
--    limit 1;
-- so the leading column is the filter, asked_at is the sort.
create index if not exists idx_queries_is_demo_asked_at
  on queries (is_demo, asked_at desc);
