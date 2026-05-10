// scripts/launch-verify/checks/stubs.ts
// Workers replace each stub with a real check during Phase 6.
// Until replaced, each returns FAIL — this is what gates loop termination.

import type { Check } from "../types";

const stub = (name: string, what: string): Check => ({
  name,
  run: async () => ({
    pass: false,
    detail: `STUB — not yet implemented: ${what}. Phase 6 worker must replace this.`,
  }),
});

export const stubChecks: Check[] = [
  stub("migrations-applied",       "all supabase/migrations/*.sql present in linked project"),
  stub("preview-env-vars",         "all required Vercel Preview env vars set on feat/post-waitlist"),
  stub("mainnet-readiness",        "RPC reachable + treasury resolves + min balance + Pyth feeds valid"),
  stub("rate-limiting",            "rate-limit middleware present on /api/queries, /api/agents/register, /api/credits/topup"),
  stub("webhook-security",         "per-agent webhook secret encrypted at rest + HMAC verified on dispatch"),
  stub("settlement-cron",          "/api/settle authenticated by SETTLEMENT_CRON_SECRET + cron scheduled"),
  stub("house-agent-live",         "ssh taco reachable + house agent claimed + launchd active + last_response_at fresh"),
  stub("e2e-fixture-pass",         "npm run e2e:fixture exits 0 against staging"),
  stub("cutover-runbook-present",  "CUTOVER_RUNBOOK.md exists at repo root with manual cutover steps"),
  stub("staging-smoke",            "/arena, /agents, /ask, /docs, /terms each return 200; no console errors"),
  stub("empty-state-honesty",      "no scripts/seed-*.ts file exists in repo"),
];
