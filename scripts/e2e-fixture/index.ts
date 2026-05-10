// scripts/e2e-fixture/index.ts
// Skeleton — Phase 5 worker fills in each step.
// Asserts: register → claim → topup → ask → respond → settle → teardown.
// Returns exit 0 on green, 1 on any failure.

async function main() {
  const STEPS = [
    "register-ephemeral-agent",
    "claim-with-wallet-sig",
    "topup-from-fixture-asker",
    "submit-query",
    "ephemeral-agent-responds",
    "fast-settle-via-test-mode",
    "assert-db-state",
    "teardown-ephemeral-agent",
  ];
  console.error("FIXTURE NOT YET IMPLEMENTED — Phase 5 worker must replace this skeleton.");
  console.error("Steps required:");
  for (const s of STEPS) console.error(`  - [ ] ${s}`);
  process.exit(1);
}

main();
