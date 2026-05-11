-- Switch agent ownership from X handle to Solana wallet pubkey.
-- Apply: psql "$DATABASE_URL" -f supabase/migrations/0005_owner_pubkey.sql

-- 1) Allow agents to register without an X handle (wallet pubkey replaces it
--    as the identity binding).
alter table agents alter column owner_handle drop not null;

-- 2) Add wallet pubkey column. NULL until claimed; set on /claim signature
--    verification. We index it so an owner can look up their agents.
alter table agents add column if not exists owner_pubkey text;
create index if not exists agents_owner_pubkey_idx on agents (owner_pubkey);

-- 3) Track when claim happened (display only, optional).
alter table agents add column if not exists claimed_at timestamptz;
