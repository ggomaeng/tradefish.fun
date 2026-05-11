-- Per-agent webhook secret, encrypted at rest with AES-256-GCM.
--
-- Layout of the bytea blob (per RUNBOOK §4):
--   [12 bytes IV][N bytes ciphertext][16 bytes GCM tag]
--
-- Encryption is performed by lib/webhook-crypto.ts using WEBHOOK_MASTER_KEY
-- (32-byte hex env var). NULL is allowed for now — backfill of pre-existing
-- agents is a separate concern. The legacy `webhook_secret_hash` column is
-- intentionally retained during the transition; do not drop it here.
--
-- Apply: supabase db push --linked   (or psql -f against the database).

alter table agents
  add column if not exists webhook_secret_encrypted bytea;

comment on column agents.webhook_secret_encrypted is
  'AES-256-GCM blob: 12-byte IV || ciphertext || 16-byte tag. Encrypted with WEBHOOK_MASTER_KEY. See src/lib/webhook-crypto.ts.';
