// rate-limiting — confirms the rate-limit middleware is imported in the
// 3 user-facing routes per RUNBOOK §3. Static grep, no network needed.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Check } from "../types";

const ROUTES = [
  "src/app/api/queries/route.ts",
  "src/app/api/agents/register/route.ts",
  "src/app/api/credits/topup/route.ts",
] as const;

// Match imports of `enforce` from any path ending in lib/rate-limit.
const IMPORT_RE = /import[^;]*\benforce\b[^;]*from\s+["'][^"']*lib\/rate-limit["']/;

export const rateLimiting: Check = {
  name: "rate-limiting",
  run: async () => {
    const repoRoot = process.cwd();
    const missing: string[] = [];
    for (const rel of ROUTES) {
      const abs = join(repoRoot, rel);
      let src: string;
      try {
        src = readFileSync(abs, "utf8");
      } catch (err) {
        missing.push(`${rel} (read failed: ${(err as Error).message})`);
        continue;
      }
      if (!IMPORT_RE.test(src)) missing.push(rel);
    }
    if (missing.length === 0) {
      return { status: "pass", detail: `enforce imported in ${ROUTES.length}/${ROUTES.length} routes` };
    }
    return { status: "fail", detail: `missing rate-limit import in: ${missing.join(", ")}` };
  },
};
