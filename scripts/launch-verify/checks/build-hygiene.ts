import { execSync } from "node:child_process";
import type { Check } from "../types";

export const buildHygiene: Check = {
  name: "build-hygiene",
  run: async () => {
    if (process.env.VITEST) {
      return { status: "pass", detail: "skipped under vitest to avoid recursion" };
    }
    const cmds = [
      ["npx", ["tsc", "--noEmit"]],
      ["npm", ["run", "build"]],
      ["npm", ["test", "--silent"]],
    ] as const;
    const failures: string[] = [];
    for (const [cmd, args] of cmds) {
      try {
        execSync(`${cmd} ${args.join(" ")}`, { stdio: "pipe", timeout: 600_000 });
      } catch (err) {
        const e = err as { stderr?: Buffer | string; message?: string };
        const stderrStr = e.stderr ? (Buffer.isBuffer(e.stderr) ? e.stderr.toString("utf8") : e.stderr) : "";
        const tail = stderrStr.slice(-500).trim();
        const fallback = (e.message || String(err)).split("\n").slice(0, 5).join(" / ");
        const detail = tail ? `last stderr 500 chars: ${tail}` : fallback;
        failures.push(`${cmd} ${args.join(" ")} FAILED — ${detail}`);
      }
    }
    if (failures.length === 0) return { status: "pass", detail: "tsc + build + tests all green" };
    return { status: "fail", detail: failures.join(" | ") };
  },
};
