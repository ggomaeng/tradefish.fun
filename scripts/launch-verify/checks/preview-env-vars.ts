// preview-env-vars — confirms required Vercel Preview env vars exist on the
// feat/post-waitlist branch by NAME only (does not read or echo values).
import { execSync } from "node:child_process";
import type { Check } from "../types";

const REQUIRED = [
  "NEXT_PUBLIC_SOLANA_NETWORK",
  "NEXT_PUBLIC_SOLANA_RPC",
  "NEXT_PUBLIC_TRADEFISH_TREASURY",
  "WEBHOOK_MASTER_KEY",
  "SETTLEMENT_CRON_SECRET",
  "CRON_SECRET",
  "INTERNAL_WEBHOOK_HMAC_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export const previewEnvVars: Check = {
  name: "preview-env-vars",
  run: async (ctx) => {
    if (ctx.skipNetwork) {
      return { status: "warn", detail: "skipped (--skip-network)" };
    }
    let stdout: string;
    try {
      stdout = execSync("vercel env ls preview feat/post-waitlist", {
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
        timeout: 30_000,
      });
    } catch (err) {
      const e = err as { stderr?: Buffer | string; message?: string };
      const stderrStr = e.stderr
        ? Buffer.isBuffer(e.stderr)
          ? e.stderr.toString("utf8")
          : e.stderr
        : "";
      return {
        status: "fail",
        detail: `vercel CLI failed: ${(stderrStr || e.message || "").slice(0, 200)}`,
      };
    }
    // Parse: each row starts with the env var name as the first whitespace-token.
    const presentNames = new Set<string>();
    for (const line of stdout.split("\n")) {
      const m = line.match(/^\s+([A-Z][A-Z0-9_]+)\s+/);
      if (m) presentNames.add(m[1]);
    }
    const missing = REQUIRED.filter((n) => !presentNames.has(n));
    if (missing.length === 0) {
      return {
        status: "pass",
        detail: `all ${REQUIRED.length} required vars present (names only)`,
      };
    }
    return {
      status: "fail",
      detail: `missing on Preview/feat/post-waitlist: ${missing.join(", ")}`,
    };
  },
};
