-- ═══════════════════════════════════════════════════════════════════════
-- 0004_credits.sql — Solana wallet credit system
--
-- Maps a Solana wallet pubkey to a credit balance. Credits are purchased
-- by sending SOL to the TradeFish treasury (NEXT_PUBLIC_TRADEFISH_TREASURY).
-- The /api/credits/topup endpoint verifies each transaction on-chain via
-- Connection.getTransaction() and inserts into `topups` (the unique
-- constraint on signature is the idempotency guard) before bumping the
-- wallet_credits row.
--
-- Pricing (locked):
--   0.01 SOL  = 10,000,000 lamports = 10 credits
--   1 credit  =  1,000,000 lamports
--   1 standard `buy_sell_now` query = 10 credits
--
-- Apply to your Supabase project:
--   psql "$DATABASE_URL" -f supabase/migrations/0004_credits.sql
--
-- Reads/writes go through dbAdmin() (service role); RLS is intentionally
-- left off for these tables — only server-side route handlers touch them.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists wallet_credits (
  wallet_pubkey text primary key,
  credits int not null default 0,
  total_topped_up_lamports bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists topups (
  id uuid primary key default gen_random_uuid(),
  signature text unique not null,
  wallet_pubkey text not null,
  lamports bigint not null,
  credits_added int not null,
  status text not null default 'confirmed',
  block_time timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists topups_wallet_idx on topups (wallet_pubkey, created_at desc);

-- RLS off for service role; we go through dbAdmin only for these.
