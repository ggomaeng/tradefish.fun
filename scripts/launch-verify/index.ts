// scripts/launch-verify/index.ts
// Usage: npm run launch:verify -- --target=<URL>
//   Writes structured report to .loop-state/last-verify.json
//   Exits 0 if all checks pass, 1 otherwise.

import { writeFileSync, mkdirSync } from "node:fs";
import { runChecks } from "./run";
import { buildHygiene } from "./checks/build-hygiene";
import { stubChecks } from "./checks/stubs";

function parseTarget(): string {
  const arg = process.argv.find(a => a.startsWith("--target="));
  if (!arg) {
    console.error("ERROR: --target=<URL> is required");
    process.exit(2);
  }
  return arg.slice("--target=".length);
}

async function main() {
  const target = parseTarget();
  const allChecks = [buildHygiene, ...stubChecks];
  const report = await runChecks(target, allChecks);

  mkdirSync(".loop-state", { recursive: true });
  writeFileSync(".loop-state/last-verify.json", JSON.stringify(report, null, 2));

  console.log(`\nlaunch-verify @ ${target}`);
  for (const r of report.results) {
    const mark = r.pass ? "✓" : "✗";
    console.log(`  ${mark} ${r.name.padEnd(30)} ${r.detail}`);
  }
  const passed = report.results.filter(r => r.pass).length;
  console.log(`\n${passed}/${report.results.length} checks passed. exit ${report.exit_code}.`);

  process.exit(report.exit_code);
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
