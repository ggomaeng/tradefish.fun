import { describe, it, expect } from "vitest";
import { runChecks } from "../run";
import type { Check } from "../types";

describe("runChecks", () => {
  it("returns exit_code=0 when all checks pass", async () => {
    const checks: Check[] = [
      { name: "a", run: async () => ({ status: "pass", detail: "ok" }) },
      { name: "b", run: async () => ({ status: "pass", detail: "ok" }) },
    ];
    const report = await runChecks("https://example.com", checks);
    expect(report.exit_code).toBe(0);
    expect(report.results).toHaveLength(2);
    expect(report.results.every((r) => r.pass)).toBe(true);
  });

  it("returns exit_code=1 when any check fails", async () => {
    const checks: Check[] = [
      { name: "a", run: async () => ({ status: "pass", detail: "ok" }) },
      { name: "b", run: async () => ({ status: "fail", detail: "broken" }) },
    ];
    const report = await runChecks("https://example.com", checks);
    expect(report.exit_code).toBe(1);
    expect(report.results.find((r) => r.name === "b")?.pass).toBe(false);
  });

  it("treats warn as non-blocking (exit_code=0)", async () => {
    const checks: Check[] = [
      { name: "a", run: async () => ({ status: "pass", detail: "ok" }) },
      { name: "b", run: async () => ({ status: "warn", detail: "non-blocking" }) },
    ];
    const report = await runChecks("https://example.com", checks);
    expect(report.exit_code).toBe(0);
    const warnRes = report.results.find((r) => r.name === "b");
    expect(warnRes?.status).toBe("warn");
    expect(warnRes?.pass).toBe(false);
  });

  it("captures duration_ms for every result", async () => {
    const checks: Check[] = [
      { name: "a", run: async () => ({ status: "pass", detail: "ok" }) },
    ];
    const report = await runChecks("https://example.com", checks);
    expect(report.results[0].duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("does not throw when a check throws — captures as failure", async () => {
    const checks: Check[] = [
      {
        name: "thrower",
        run: async () => {
          throw new Error("boom");
        },
      },
    ];
    const report = await runChecks("https://example.com", checks);
    expect(report.exit_code).toBe(1);
    expect(report.results[0].pass).toBe(false);
    expect(report.results[0].status).toBe("fail");
    expect(report.results[0].detail).toContain("boom");
  });

  it("propagates skipNetwork via context", async () => {
    let saw: boolean | null = null;
    const checks: Check[] = [
      {
        name: "ctx",
        run: async (ctx) => {
          saw = ctx.skipNetwork;
          return { status: "pass", detail: "ok" };
        },
      },
    ];
    await runChecks({ target: "https://example.com", skipNetwork: true }, checks);
    expect(saw).toBe(true);
  });
});
