// staging-smoke — curl 5 endpoints on the staging URL with expected status codes.
import type { Check } from "../types";

type Probe = {
  path: string;
  method: "GET" | "POST";
  body?: string;
  contentType?: string;
  expectStatus: number | number[];
};

const PROBES: Probe[] = [
  { path: "/", method: "GET", expectStatus: 200 },
  { path: "/arena", method: "GET", expectStatus: 200 },
  { path: "/skill.md", method: "GET", expectStatus: 200 },
  // /api/settle exports GET only (Vercel Cron). Without auth: 401 (or 500 if env unset).
  { path: "/api/settle", method: "GET", expectStatus: [401, 500] },
  // /api/credits/topup with empty JSON should be 400 (zod parse fail)
  {
    path: "/api/credits/topup",
    method: "POST",
    body: "{}",
    contentType: "application/json",
    expectStatus: 400,
  },
];

function ok(actual: number, expected: number | number[]): boolean {
  return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
}

export const stagingSmoke: Check = {
  name: "staging-smoke",
  run: async (ctx) => {
    if (ctx.skipNetwork) {
      return { status: "warn", detail: "skipped (--skip-network)" };
    }
    const base = ctx.target.replace(/\/$/, "");
    const failures: string[] = [];
    const passDetails: string[] = [];
    for (const p of PROBES) {
      try {
        const init: RequestInit = { method: p.method };
        if (p.body !== undefined) {
          init.body = p.body;
          init.headers = { "content-type": p.contentType ?? "application/json" };
        }
        const res = await fetch(base + p.path, init);
        if (ok(res.status, p.expectStatus)) {
          passDetails.push(`${p.path}=${res.status}`);
        } else {
          failures.push(
            `${p.path} expected=${JSON.stringify(p.expectStatus)} got=${res.status}`,
          );
        }
      } catch (err) {
        failures.push(`${p.path} threw: ${(err as Error).message}`);
      }
    }
    if (failures.length === 0) {
      return { status: "pass", detail: `${passDetails.length}/${PROBES.length} probes OK (${passDetails.join(", ")})` };
    }
    return { status: "fail", detail: failures.join(" | ") };
  },
};
