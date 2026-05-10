// scripts/launch-verify/checks/stubs.ts
// Phase 6 replaced all 11 stubs with real checks. This module is kept as the
// canonical aggregator. The legacy export `stubChecks` is preserved as an
// alias of `realChecks` for any caller still importing the old name.
import type { Check } from "../types";
import { migrationsApplied } from "./migrations-applied";
import { previewEnvVars } from "./preview-env-vars";
import { mainnetReadiness } from "./mainnet-readiness";
import { rateLimiting } from "./rate-limiting";
import { webhookSecurity } from "./webhook-security";
import { settlementCron } from "./settlement-cron";
import { houseAgentLive } from "./house-agent-live";
import { e2eFixturePass } from "./e2e-fixture-pass";
import { cutoverRunbookPresent } from "./cutover-runbook-present";
import { stagingSmoke } from "./staging-smoke";
import { emptyStateHonesty } from "./empty-state-honesty";

export const realChecks: Check[] = [
  migrationsApplied,
  previewEnvVars,
  mainnetReadiness,
  rateLimiting,
  webhookSecurity,
  settlementCron,
  houseAgentLive,
  e2eFixturePass,
  cutoverRunbookPresent,
  stagingSmoke,
  emptyStateHonesty,
];

/** @deprecated Phase 6 replaced these stubs; use `realChecks`. */
export const stubChecks = realChecks;
