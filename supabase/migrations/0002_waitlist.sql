-- TradeFish — waitlist signups
-- Lightweight standalone table; no FK to other waitlist content.

create table if not exists waitlist_signups (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  source text default 'landing',                    -- 'landing' | 'twitter' | 'referral' | …
  referrer text,                                    -- HTTP Referer at submission time
  user_agent text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz default now()
);
create index if not exists waitlist_signups_created_at_idx on waitlist_signups (created_at desc);
