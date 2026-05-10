// house-agent-live — SSH to taco; verify launchd label is loaded with PID and
// exit_status=0; verify ~/tradefish-house-agent/logs/last_response.json exists
// and is fresh (within 24h).
import { execSync } from "node:child_process";
import type { Check } from "../types";

const SSH_HOST = "taco";
const TIMEOUT_MS = 15_000;

function ssh(cmd: string): string {
  // BatchMode=yes prevents password prompts hanging on missing keys.
  // ConnectTimeout caps slow connects.
  return execSync(
    `ssh -o BatchMode=yes -o ConnectTimeout=10 ${SSH_HOST} ${JSON.stringify(cmd)}`,
    { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", timeout: TIMEOUT_MS },
  );
}

export const houseAgentLive: Check = {
  name: "house-agent-live",
  run: async (ctx) => {
    if (ctx.skipNetwork) {
      return { status: "warn", detail: "skipped (--skip-network)" };
    }

    // (1) launchctl list | grep tradefish — expect: PID  exit  label
    let listOut: string;
    try {
      listOut = ssh("launchctl list | grep tradefish || true");
    } catch (err) {
      return { status: "fail", detail: `ssh launchctl failed: ${(err as Error).message}` };
    }
    const line = listOut.trim().split("\n").find((l) => l.includes("tradefish")) ?? "";
    if (!line) {
      return { status: "fail", detail: "no tradefish entry in launchctl list" };
    }
    // Format: "<pid>\t<status>\t<label>"
    const parts = line.split(/\s+/).filter(Boolean);
    const pid = parts[0];
    const exitStatus = parts[1];
    const label = parts[2];
    if (!pid || pid === "-" || isNaN(Number(pid))) {
      return { status: "fail", detail: `launchctl: no PID for ${label ?? "tradefish"} (line=${line})` };
    }
    if (exitStatus !== "0") {
      return {
        status: "fail",
        detail: `launchctl: ${label ?? "tradefish"} pid=${pid} exit_status=${exitStatus}`,
      };
    }

    // (2) last_response.json freshness
    let lastJson: string;
    try {
      lastJson = ssh("cat ~/tradefish-house-agent/logs/last_response.json 2>&1 || echo MISSING");
    } catch (err) {
      return { status: "fail", detail: `ssh cat failed: ${(err as Error).message}` };
    }
    if (lastJson.includes("MISSING") || lastJson.trim().length === 0) {
      // Agent may simply not have answered any query yet — that's a warn,
      // not a fail. The launchd entry being healthy is the hard requirement.
      return {
        status: "warn",
        detail: `pid=${pid} exit=0; last_response.json absent (agent hasn't answered any query yet)`,
      };
    }
    let parsed: { responded_at?: string; ts?: string };
    try {
      parsed = JSON.parse(lastJson);
    } catch {
      return {
        status: "warn",
        detail: `pid=${pid} exit=0; last_response.json present but not JSON (legacy format)`,
      };
    }
    const tsStr = parsed.responded_at ?? parsed.ts;
    if (!tsStr) {
      return {
        status: "warn",
        detail: `pid=${pid} exit=0; last_response.json present but no responded_at/ts field`,
      };
    }
    const ageMs = Date.now() - new Date(tsStr).getTime();
    const ageHrs = ageMs / 3_600_000;
    if (Number.isNaN(ageMs) || ageHrs > 24) {
      return {
        status: "warn",
        detail: `pid=${pid} exit=0; last response ${ageHrs.toFixed(1)}h ago (stale)`,
      };
    }
    return {
      status: "pass",
      detail: `pid=${pid} exit=0; last response ${ageHrs.toFixed(2)}h ago`,
    };
  },
};
