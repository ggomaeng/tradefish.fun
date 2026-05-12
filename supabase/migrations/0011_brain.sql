-- 0011_brain.sql
-- Brain feature: wiki provenance, retrieval log, answer citations, note graph edges.
--
-- Schema divergences from spec (spec used placeholder names; adapted to real schema):
--   spec: rounds(id)   → actual: queries(id)   (there is no `rounds` table)
--   spec: answers(id)  → actual: responses(id)  (there is no `answers` table)
--
-- Re-runnable: add-column ops wrapped in do-blocks; CREATE TABLE uses IF NOT EXISTS;
-- indexes use IF NOT EXISTS; RPC uses CREATE OR REPLACE.
-- Does NOT drop or modify match_wiki.

-- ─── 1. Extend wiki_entries ────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'wiki_entries' and column_name = 'author_agent_id'
  ) then
    alter table wiki_entries
      add column author_agent_id uuid references agents(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'wiki_entries' and column_name = 'source_round_id'
  ) then
    -- NOTE: spec named this `rounds(id)` but the actual table is `queries`.
    alter table wiki_entries
      add column source_round_id uuid references queries(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'wiki_entries' and column_name = 'tokens'
  ) then
    alter table wiki_entries
      add column tokens text[] default '{}';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'wiki_entries' and column_name = 'pnl_attributed_usd'
  ) then
    alter table wiki_entries
      add column pnl_attributed_usd numeric default 0;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'wiki_entries' and column_name = 'cite_count'
  ) then
    alter table wiki_entries
      add column cite_count int default 0;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'wiki_entries' and column_name = 'created_at'
  ) then
    alter table wiki_entries
      add column created_at timestamptz default now();
  end if;
end $$;

create index if not exists wiki_entries_tokens_gin
  on wiki_entries using gin (tokens);

create index if not exists wiki_entries_created_at
  on wiki_entries (created_at desc);

-- ─── 2. agent_retrievals — search log for retrieval replay ────────────────────

create table if not exists agent_retrievals (
  id          uuid      primary key default gen_random_uuid(),
  agent_id    uuid      references agents(id) on delete set null,
  query_text  text      not null,
  slugs       text[]    not null,
  created_at  timestamptz default now()
);

create index if not exists idx_agent_retrievals_agent_at
  on agent_retrievals (agent_id, created_at desc);

-- ─── 3. answer_citations — links responses ↔ wiki notes ──────────────────────
-- NOTE: spec named the FK column `answer_id references answers(id)` but the
-- actual table is `responses`. Column kept as `answer_id` for API clarity;
-- FK points to `responses(id)`.

create table if not exists answer_citations (
  answer_id  uuid  references responses(id) on delete cascade,
  slug       text  references wiki_entries(slug) on delete cascade,
  source     text  not null check (source in ('retrieved', 'explicit')),
  weight     numeric not null,
  primary key (answer_id, slug)
);

create index if not exists idx_answer_citations_slug
  on answer_citations (slug);

-- ─── 4. note_edges — pre-materialized adjacency for the graph ─────────────────

create table if not exists note_edges (
  from_slug     text     references wiki_entries(slug) on delete cascade,
  to_slug       text     references wiki_entries(slug) on delete cascade,
  similarity    numeric  not null,
  co_cite_count int      default 0,
  pnl_flow_usd  numeric  default 0,
  updated_at    timestamptz default now(),
  primary key (from_slug, to_slug),
  check (from_slug < to_slug)   -- undirected canonicalization
);

create index if not exists idx_note_edges_pnl_flow
  on note_edges (pnl_flow_usd desc);

create index if not exists idx_note_edges_similarity
  on note_edges (similarity desc);

-- ─── 5. brain_graph RPC ───────────────────────────────────────────────────────

create or replace function brain_graph(
  t_max timestamptz default now()
)
returns json
language sql stable as $$
  select json_build_object(
    'nodes', (
      select coalesce(
        json_agg(json_build_object(
          'id',             slug,
          'title',          title,
          'tokens',         tokens,
          'pnl_usd',        pnl_attributed_usd,
          'cite_count',     cite_count,
          'created_at',     created_at,
          'author_agent_id', author_agent_id
        )),
        '[]'::json
      )
      from wiki_entries
      where created_at <= t_max
    ),
    'edges', (
      select coalesce(
        json_agg(json_build_object(
          'source',        from_slug,
          'target',        to_slug,
          'similarity',    similarity,
          'co_cite_count', co_cite_count,
          'pnl_flow_usd',  pnl_flow_usd
        )),
        '[]'::json
      )
      from note_edges
      where updated_at <= t_max
    )
  );
$$;

-- ─── 6. Realtime publication ──────────────────────────────────────────────────
-- Each alter is wrapped in a do-block to catch "already a member" gracefully.

do $$
begin
  alter publication supabase_realtime add table wiki_entries;
exception
  when sqlstate '42710' then null;  -- duplicate_object / already a member
  when others then raise;
end $$;

do $$
begin
  alter publication supabase_realtime add table note_edges;
exception
  when sqlstate '42710' then null;
  when others then raise;
end $$;

do $$
begin
  alter publication supabase_realtime add table answer_citations;
exception
  when sqlstate '42710' then null;
  when others then raise;
end $$;
