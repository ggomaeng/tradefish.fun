// e2e-fixture-pass — runs `npm run e2e:fixture` against the staging target
// and confirms outcome:"ok". The fixture script auto-cleans on success.
import { execSync } from "node:child_process";
import type { Check } from "../types";

const TIMEOUT_MS = 90_000;

export const e2eFixturePass: Check = {
  name: "e2e-fixture-pass",
  run: async (ctx) => {
    if (ctx.skipNetwork) {
      return { status: "warn", detail: "skipped (--skip-network)" };
    }
    // The fixture script defaults to devnet if NEXT_PUBLIC_SOLANA_NETWORK is
    // unset — but the staging deploy is mainnet-only (RUNBOOK §10.5). Override
    // here so a stale local .env.local (devnet) doesn't poison the run.
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      NEXT_PUBLIC_SOLANA_NETWORK: "mainnet-beta",
      NEXT_PUBLIC_SOLANA_RPC: "https://api.mainnet-beta.solana.com",
      NEXT_PUBLIC_TRADEFISH_TREASURY: "CFgBLpStEPRZf2pHiUbccB731avjvUb7a9yBApu3jR7Y",
    };
    let stdout: string;
    try {
      stdout = execSync(
        `npm run e2e:fixture --silent -- --target=${ctx.target}`,
        {
          stdio: ["ignore", "pipe", "pipe"],
          encoding: "utf8",
          timeout: TIMEOUT_MS,
          env: childEnv,
        },
      );
    } catch (err) {
      const e = err as { stdout?: Buffer | string; stderr?: Buffer | string; message?: string };
      const out = e.stdout
        ? Buffer.isBuffer(e.stdout)
          ? e.stdout.toString("utf8")
          : e.stdout
        : "";
      const errStr = e.stderr
        ? Buffer.isBuffer(e.stderr)
          ? e.stderr.toString("utf8")
          : e.stderr
        : "";
      return {
        status: "fail",
        detail: `e2e:fixture exited non-zero — ${(out + errStr).trim().split("\n").pop()?.slice(0, 200) ?? e.message}`,
      };
    }
    // Find a JSON object line in stdout — the fixture prints a JSON summary.
    const lines = stdout.trim().split("\n");
    let parsed: { outcome?: string; query_id?: string; latency_ms?: number } | null = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith("{") && line.endsWith("}")) {
        try {
          parsed = JSON.parse(line);
          break;
        } catch {
          /* keep scanning */
        }
      }
    }
    if (!parsed) {
      return {
        status: "fail",
        detail: `could not parse JSON summary from e2e:fixture stdout (last 200: ${stdout.slice(-200).trim()})`,
      };
    }
    if (parsed.outcome === "ok") {
      return {
        status: "pass",
        detail: `outcome=ok query_id=${parsed.query_id} latency_ms=${parsed.latency_ms}`,
      };
    }
    return { status: "fail", detail: `outcome=${parsed.outcome} (expected "ok")` };
  },
};
