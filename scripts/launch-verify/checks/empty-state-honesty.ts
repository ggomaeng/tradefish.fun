// empty-state-honesty — RUNBOOK §10.4 says "no seeded data": the first
// registered agent populates the arena. We enforce this by globbing for
// `scripts/seed-*.ts`.
//
// Deviation note: `scripts/seed-tokens.ts` exists but is *not* user-content
// seed data — it syncs the SUPPORTED_TOKENS allow-list (a config table)
// from src/lib/supported-tokens.ts. Per the spirit of §10.4 (no seeded
// agents/queries/responses), this file is allow-listed.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Check } from "../types";

const ALLOW_LIST = new Set<string>(["seed-tokens.ts"]);

export const emptyStateHonesty: Check = {
  name: "empty-state-honesty",
  run: async () => {
    const scriptsDir = join(process.cwd(), "scripts");
    let entries: string[] = [];
    try {
      entries = readdirSync(scriptsDir);
    } catch {
      // No scripts directory at all — vacuously pass.
      return { status: "pass", detail: "scripts/ does not exist (no seed scripts possible)" };
    }
    const seeders = entries.filter(
      (name) => /^seed-.*\.ts$/.test(name) && !ALLOW_LIST.has(name),
    );
    if (seeders.length === 0) {
      const allowed = entries.filter((n) => /^seed-.*\.ts$/.test(n));
      const allowNote = allowed.length > 0 ? ` (allow-listed: ${allowed.join(", ")})` : "";
      return {
        status: "pass",
        detail: `no user-data seed scripts in scripts/${allowNote}`,
      };
    }
    return {
      status: "fail",
      detail: `RUNBOOK §10.4 violation — found seed scripts: ${seeders.join(", ")}`,
    };
  },
};
