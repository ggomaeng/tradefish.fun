import { execSync } from "node:child_process";
import type { Check } from "../types";

export const buildHygiene: Check = {
  name: "build-hygiene",
  run: async () => {
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
        const msg = err instanceof Error ? err.message : String(err);
        failures.push(`${cmd} ${args.join(" ")}: ${msg.split("\n")[0]}`);
      }
    }
    if (failures.length === 0) return { pass: true, detail: "tsc + build + tests all green" };
    return { pass: false, detail: failures.join(" | ") };
  },
};
