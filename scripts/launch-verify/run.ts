import type { Check, CheckContext, CheckResult, VerifyReport } from "./types";

export async function runChecks(
  ctxOrTarget: CheckContext | string,
  checks: Check[],
): Promise<VerifyReport> {
  const ctx: CheckContext =
    typeof ctxOrTarget === "string"
      ? { target: ctxOrTarget, skipNetwork: false }
      : ctxOrTarget;

  const results: CheckResult[] = [];
  for (const c of checks) {
    const t0 = Date.now();
    try {
      const r = await c.run(ctx);
      results.push({
        name: c.name,
        status: r.status,
        pass: r.status === "pass",
        detail: r.detail,
        duration_ms: Date.now() - t0,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        name: c.name,
        status: "fail",
        pass: false,
        detail: `threw: ${msg}`,
        duration_ms: Date.now() - t0,
      });
    }
  }
  // Exit 0 only if no `fail`; warns are non-blocking.
  const anyFail = results.some((r) => r.status === "fail");
  return {
    target: ctx.target,
    ran_at: new Date().toISOString(),
    exit_code: anyFail ? 1 : 0,
    results,
  };
}
