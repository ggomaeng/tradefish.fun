-- Rate limits — per-(subject, route) sliding-window counters.
-- Subject is wallet pubkey when the caller is wallet-authenticated, otherwise
-- the request IP (X-Forwarded-For first hop). The window_start column is the
-- truncated start of a fixed window; the application chooses the window size
-- (default: 60s, see lib/rate-limit.ts).
--
-- Apply: supabase db push --linked   (or psql -f against the database).

create table if not exists rate_limits (
  subject text not null,           -- wallet pubkey or IP
  route text not null,             -- normalized API route, e.g. /api/queries
  window_start timestamptz not null,
  count int not null default 1,
  primary key (subject, route, window_start)
);

create index if not exists rate_limits_window_idx on rate_limits (window_start);

-- Lazy cleanup: callers can issue this periodically. We don't add a pg_cron job
-- here to keep the migration portable across Supabase plans. The application
-- may opportunistically call it on a small percentage of requests if desired.
-- Example:
--   delete from rate_limits where window_start < now() - interval '1 hour';
