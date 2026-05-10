import { describe, it, expect } from "vitest";
import { runChecks } from "../run";
import type { Check } from "../types";

describe("runChecks", () => {
  it("returns exit_code=0 when all checks pass", async () => {
    const checks: Check[] = [
      { name: "a", run: async () => ({ pass: true, detail: "ok" }) },
      { name: "b", run: async () => ({ pass: true, detail: "ok" }) },
    ];
    const report = await runChecks("https://example.com", checks);
    expect(report.exit_code).toBe(0);
    expect(report.results).toHaveLength(2);
    expect(report.results.every(r => r.pass)).toBe(true);
  });

  it("returns exit_code=1 when any check fails", async () => {
    const checks: Check[] = [
      { name: "a", run: async () => ({ pass: true, detail: "ok" }) },
      { name: "b", run: async () => ({ pass: false, detail: "broken" }) },
    ];
    const report = await runChecks("https://example.com", checks);
    expect(report.exit_code).toBe(1);
    expect(report.results.find(r => r.name === "b")?.pass).toBe(false);
  });

  it("captures duration_ms for every result", async () => {
    const checks: Check[] = [
      { name: "a", run: async () => ({ pass: true, detail: "ok" }) },
    ];
    const report = await runChecks("https://example.com", checks);
    expect(report.results[0].duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("does not throw when a check throws — captures as failure", async () => {
    const checks: Check[] = [
      { name: "thrower", run: async () => { throw new Error("boom"); } },
    ];
    const report = await runChecks("https://example.com", checks);
    expect(report.exit_code).toBe(1);
    expect(report.results[0].pass).toBe(false);
    expect(report.results[0].detail).toContain("boom");
  });
});
