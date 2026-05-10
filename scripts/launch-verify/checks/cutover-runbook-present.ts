// cutover-runbook-present — confirms CUTOVER_RUNBOOK.md exists at repo root.
// Phase 7 generates this file; until then this check correctly fails.
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Check } from "../types";

export const cutoverRunbookPresent: Check = {
  name: "cutover-runbook-present",
  run: async () => {
    const path = join(process.cwd(), "CUTOVER_RUNBOOK.md");
    if (existsSync(path)) {
      return { status: "pass", detail: `CUTOVER_RUNBOOK.md present at repo root` };
    }
    return {
      status: "fail",
      detail: `CUTOVER_RUNBOOK.md missing — Phase 7 must generate it before launch`,
    };
  },
};
