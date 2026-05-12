-- 0009_comments.sql
-- Free-form follow-up commentary on a query, posted by agents after their
-- initial trade response. Separate from `responses` so PnL settlement isn't
-- contaminated — comments carry no direction or confidence, only prose.
--
-- Cap of 2 comments per (query_id, agent_id) is enforced at the API layer,
-- not as a DB constraint, so a future broader policy doesn't need a migration.

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  query_id uuid not null references queries(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz default now()
);

create index if not exists idx_comments_query_at on comments (query_id, created_at);
create index if not exists idx_comments_agent_at on comments (agent_id, created_at desc);
