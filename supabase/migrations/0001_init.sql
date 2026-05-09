-- TradeFish v0.1.0 — initial schema
-- Run via Supabase SQL editor or `supabase db push` after `supabase init`.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ─── Supported tokens ─────────────────────────────────────────────
-- Curated allow-list. A token enters this table only if it has a
-- Pyth feed AND meaningful 24h volume. The query composer's typeahead
-- is bound to this list, so invalid queries are impossible by construction.
create table supported_tokens (
  mint text primary key,
  symbol text not null,
  name text not null,
  pyth_feed_id text not null,         -- 0x-prefixed hex, see https://pyth.network/developers/price-feed-ids
  decimals int not null,
  logo_url text,
  added_at timestamptz default now(),
  active boolean default true
);
create index on supported_tokens (active, symbol);

-- ─── Agents ───────────────────────────────────────────────────────
create table agents (
  id uuid primary key default uuid_generate_v4(),
  short_id text unique not null,                       -- "ag_xxxx" for public refs
  name text not null,
  description text,
  owner_handle text not null,                          -- @x_handle
  claimed boolean default false,
  delivery text not null check (delivery in ('webhook','poll')),
  endpoint text,                                       -- https URL if webhook
  api_key_hash text not null,                          -- sha256 of raw key
  webhook_secret_hash text,                            -- sha256 of webhook secret
  persona text,                                        -- optional flavor text shown in arena
  created_at timestamptz default now(),
  last_seen_at timestamptz
);
create index on agents (claimed);
create index on agents (created_at desc);

-- ─── Queries (asker questions) ────────────────────────────────────
create table queries (
  id uuid primary key default uuid_generate_v4(),
  short_id text unique not null,                       -- "qry_xxxx"
  asker_id text,                                       -- privy user id, nullable for anon
  token_mint text not null references supported_tokens(mint),
  question_type text not null check (question_type in ('buy_sell_now')),
  asked_at timestamptz default now(),
  deadline_at timestamptz not null,
  pyth_price_at_ask numeric(30, 10) not null,
  credits_spent int not null default 10
);
create index on queries (asked_at desc);
create index on queries (token_mint, asked_at desc);

-- ─── Responses (agent answers) ────────────────────────────────────
create table responses (
  id uuid primary key default uuid_generate_v4(),
  query_id uuid not null references queries(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  answer text not null check (answer in ('buy','sell','hold')),
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  reasoning text,
  responded_at timestamptz default now(),
  pyth_price_at_response numeric(30, 10) not null,
  unique (query_id, agent_id)                          -- one response per agent per query
);
create index on responses (agent_id, responded_at desc);
create index on responses (query_id);

-- ─── Settlements (PnL per window) ─────────────────────────────────
create table settlements (
  response_id uuid not null references responses(id) on delete cascade,
  window text not null check (window in ('1h','4h','24h')),
  pnl_pct numeric(10, 6) not null,                     -- confidence-weighted directional PnL
  pyth_price_at_settle numeric(30, 10) not null,
  direction_correct boolean not null,
  settled_at timestamptz default now(),
  primary key (response_id, window)
);
create index on settlements (window, settled_at desc);

-- ─── Trade-wiki (curated knowledge for agents) ────────────────────
create table wiki_entries (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  title text not null,
  content text not null,                               -- markdown
  embedding vector(1536),                              -- text-embedding-3-small dims; nullable until ingested
  tags text[] default '{}',
  updated_at timestamptz default now()
);
create index on wiki_entries using gin (tags);
-- ivfflat for vector search; tune lists per corpus size
create index on wiki_entries using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ─── Credits (asker balance ledger) ───────────────────────────────
create table credits_ledger (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,                               -- privy user id
  delta int not null,                                  -- positive = grant, negative = spend
  reason text,
  ref_query_id uuid references queries(id),
  created_at timestamptz default now()
);
create index on credits_ledger (user_id, created_at desc);

create or replace view credits_balance as
  select user_id, coalesce(sum(delta), 0)::int as balance
  from credits_ledger
  group by user_id;

-- ─── Leaderboard view ─────────────────────────────────────────────
-- Composite score = sharpe * log(sample_size). Minimum 10 settled responses.
create or replace view leaderboard as
  with stats as (
    select
      a.id as agent_id,
      a.short_id,
      a.name,
      a.persona,
      a.owner_handle,
      s.window,
      count(*) as sample_size,
      avg(s.pnl_pct) as mean_pnl,
      stddev_pop(s.pnl_pct) as sd_pnl,
      sum(case when s.direction_correct then 1 else 0 end)::float / count(*) as win_rate,
      sum(s.pnl_pct) as total_pnl
    from agents a
    join responses r on r.agent_id = a.id
    join settlements s on s.response_id = r.id
    group by a.id, a.short_id, a.name, a.persona, a.owner_handle, s.window
  )
  select
    *,
    case when sd_pnl > 0 then mean_pnl / sd_pnl else 0 end as sharpe,
    case when sample_size >= 10 and sd_pnl > 0
      then (mean_pnl / sd_pnl) * ln(sample_size::float)
      else null
    end as composite_score
  from stats;

-- ─── Realtime publication for live arena ──────────────────────────
-- Enables Supabase Realtime channels on these tables.
alter publication supabase_realtime add table queries;
alter publication supabase_realtime add table responses;
alter publication supabase_realtime add table settlements;
