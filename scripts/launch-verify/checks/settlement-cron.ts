// settlement-cron — curl /api/settle without auth header; expects 401 with
// code:"invalid_settlement_secret" (or 500 missing_secret if env unset).
import type { Check } from "../types";

export const settlementCron: Check = {
  name: "settlement-cron",
  run: async (ctx) => {
    if (ctx.skipNetwork) {
      return { status: "warn", detail: "skipped (--skip-network)" };
    }
    // /api/settle exports GET (Vercel Cron calls GET); POST returns 405.
    const url = `${ctx.target.replace(/\/$/, "")}/api/settle`;
    let res: Response;
    try {
      res = await fetch(url, { method: "GET" });
    } catch (err) {
      return { status: "fail", detail: `fetch failed: ${(err as Error).message}` };
    }
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // non-JSON; fall through
    }
    const code = (body as { code?: string } | null)?.code;
    if (res.status === 401 && code === "invalid_settlement_secret") {
      return { status: "pass", detail: `401 invalid_settlement_secret as expected` };
    }
    if (res.status === 500 && code === "missing_secret") {
      return {
        status: "pass",
        detail: `500 missing_secret — gate wired but env not yet set (acceptable)`,
      };
    }
    return {
      status: "fail",
      detail: `expected 401 invalid_settlement_secret; got ${res.status} code=${code ?? "<none>"}`,
    };
  },
};
