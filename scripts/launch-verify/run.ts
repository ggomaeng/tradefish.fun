import type { Check, CheckResult, VerifyReport } from "./types";

export async function runChecks(target: string, checks: Check[]): Promise<VerifyReport> {
  const results: CheckResult[] = [];
  for (const c of checks) {
    const t0 = Date.now();
    try {
      const r = await c.run(target);
      results.push({ name: c.name, pass: r.pass, detail: r.detail, duration_ms: Date.now() - t0 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ name: c.name, pass: false, detail: `threw: ${msg}`, duration_ms: Date.now() - t0 });
    }
  }
  const allPass = results.every(r => r.pass);
  return {
    target,
    ran_at: new Date().toISOString(),
    exit_code: allPass ? 0 : 1,
    results,
  };
}
