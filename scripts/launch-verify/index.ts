// scripts/launch-verify/index.ts
// Usage: npm run launch:verify -- --target=<URL> [--skip-network]
//   Writes structured report to .loop-state/last-verify.json
//   Exits 0 only if no `fail` results (warns are non-blocking).

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runChecks } from "./run";
import { buildHygiene } from "./checks/build-hygiene";
import { realChecks } from "./checks/stubs";

function parseTarget(): string {
  const arg = process.argv.find((a) => a.startsWith("--target="));
  if (!arg) {
    console.error("ERROR: --target=<URL> is required");
    process.exit(2);
  }
  return arg.slice("--target=".length);
}

function parseSkipNetwork(): boolean {
  return process.argv.includes("--skip-network");
}

/**
 * Lightweight .env.local loader — does NOT depend on dotenv (project uses
 * Next.js's built-in loader at runtime). Only fills variables that aren't
 * already set in the process env. Skips comments and blank lines.
 */
function loadEnvLocal(): { loaded: number; path: string | null } {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return { loaded: 0, path: null };
  const raw = readFileSync(path, "utf8");
  let loaded = 0;
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
      loaded++;
    }
  }
  return { loaded, path };
}

async function main() {
  const envInfo = loadEnvLocal();
  const target = parseTarget();
  const skipNetwork = parseSkipNetwork();
  const allChecks = [buildHygiene, ...realChecks];
  const report = await runChecks({ target, skipNetwork }, allChecks);

  mkdirSync(".loop-state", { recursive: true });
  writeFileSync(".loop-state/last-verify.json", JSON.stringify(report, null, 2));

  console.log(`\nlaunch-verify @ ${target}${skipNetwork ? " (--skip-network)" : ""}`);
  if (envInfo.path) {
    console.log(`  loaded ${envInfo.loaded} vars from ${envInfo.path}`);
  }
  for (const r of report.results) {
    const mark = r.status === "pass" ? "PASS" : r.status === "warn" ? "WARN" : "FAIL";
    console.log(`  [${mark}] ${r.name.padEnd(28)} ${r.detail}`);
  }
  const passed = report.results.filter((r) => r.status === "pass").length;
  const warned = report.results.filter((r) => r.status === "warn").length;
  const failed = report.results.filter((r) => r.status === "fail").length;
  console.log(
    `\n${passed} pass / ${warned} warn / ${failed} fail (${report.results.length} total). exit ${report.exit_code}.`,
  );

  process.exit(report.exit_code);
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
