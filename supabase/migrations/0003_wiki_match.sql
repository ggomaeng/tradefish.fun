-- TradeFish — pgvector match RPC for trade-wiki search.
--
-- Apply manually before /api/wiki/search will return semantic results:
--   psql "$DATABASE_URL" -f supabase/migrations/0003_wiki_match.sql
-- or paste the body below into the Supabase SQL editor.
--
-- Depends on 0001_init.sql (creates `wiki_entries` with embedding vector(1536)
-- and the ivfflat cosine index). Re-runnable thanks to `create or replace`.

create or replace function match_wiki(
  query_embedding vector(1536),
  match_count int default 5,
  match_threshold float default 0.0
) returns table (
  id uuid,
  slug text,
  title text,
  content text,
  similarity float
)
language sql stable as $$
  select id, slug, title, content,
         1 - (embedding <=> query_embedding) as similarity
  from wiki_entries
  where embedding is not null
    and (1 - (embedding <=> query_embedding)) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
