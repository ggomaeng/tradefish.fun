# Overnight Launch Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 0 infrastructure for the overnight launch loop so the user can trigger `/loop` in a fresh session and have it autonomously bring TradeFish to mainnet-launch-ready on staging by morning.

**Architecture:** Self-paced `/loop` orchestrator session reads `.loop-state/STATE.md` + `RUNBOOK.md` each tick, dispatches one general-purpose `Agent` subagent with a tight prompt and a ≤500-word report contract, updates state, schedules next wake. Workers do all code/test/deploy work in isolated context windows; orchestrator stays slim.

This plan implements Phase 0 only — the infrastructure that makes the autonomous run possible. Phases 1–8 are executed by the loop's workers at runtime, guided by `RUNBOOK.md` decisions baked in here. The verify script ships with stub checks that fail by default; workers replace stubs with real checks during Phase 6, which is what gates loop termination.

**Tech Stack:** Next.js 16, Node, TypeScript, Solana web3.js, `@solana/web3.js` Keypair, vitest, Vercel CLI, Supabase CLI, `gh` CLI, `ssh` to `taco`.

**Spec:** `docs/superpowers/specs/2026-05-09-overnight-launch-loop-design.md`

---

## File Structure

This plan creates / modifies these files. Each has one focused responsibility:

**Created:**
- `.loop-state/STATE.md` — phase plan + per-task status (gitignored)
- `.loop-state/RUNBOOK.md` — pre-committed decisions for workers (gitignored)
- `.loop-state/TICK_LOG.md` — append-only tick log (gitignored, starts empty)
- `.loop-state/worker-prompt.template.md` — worker dispatch prompt template (gitignored)
- `.loop-state/.kept` — placeholder so the directory survives git (committed)
- `scripts/launch-verify/index.ts` — verify script entry point
- `scripts/launch-verify/types.ts` — `Check`, `CheckResult` shared types
- `scripts/launch-verify/run.ts` — runs all checks, writes JSON, returns exit code
- `scripts/launch-verify/checks/build-hygiene.ts` — concrete check #1 (tsc + build + test)
- `scripts/launch-verify/checks/stubs.ts` — 11 stub checks that fail with "not yet implemented"
- `scripts/launch-verify/__tests__/run.test.ts` — vitest for the runner shape
- `scripts/e2e-fixture/index.ts` — fixture skeleton (workers fill in during Phase 5)
- `scripts/keys/generate-fixture-asker.ts` — one-shot keypair generator with funding instructions
- `secrets/.gitignore` — folder lives, contents don't
- `secrets/.kept` — placeholder

**Modified:**
- `.gitignore` — add `.loop-state/`, `secrets/`
- `package.json` — add `launch:verify`, `e2e:fixture`, `loop:keygen` scripts

---

## Task 1: Sanity-check pre-flight tooling

**Files:** none (read-only checks)

- [ ] **Step 1: Probe ssh taco**

Run: `ssh taco "uname -a && which node && node --version || echo no-node"`
Expected: prints kernel info; node version OR "no-node". Either is fine — Phase 4 worker will install node if missing.
If ssh fails entirely: STOP. User must fix ssh config before this plan can proceed.

- [ ] **Step 2: Probe Vercel CLI**

Run: `vercel whoami && vercel projects ls | head -5`
Expected: prints username and project list including `tradefish`.
If unauthenticated: ask user to run `vercel login`, then retry.

- [ ] **Step 3: Probe Supabase CLI link**

Run: `supabase projects list | head -5 && cat supabase/config.toml 2>/dev/null | head -5`
Expected: project `vzmezxnfwuwmitdfmjkh` listed; project_id in config.
If unlinked: ask user to run `supabase link --project-ref vzmezxnfwuwmitdfmjkh`.

- [ ] **Step 4: Probe gh CLI**

Run: `gh auth status && gh repo view --json name,defaultBranchRef`
Expected: authenticated; default branch shown.
If unauthenticated: ask user to run `gh auth login`.

- [ ] **Step 5: Verify clean working tree on feat/post-waitlist**

Run: `git branch --show-current && git status --short`
Expected: branch is `feat/post-waitlist`; status is empty.
If dirty: stop and ask user to commit or stash first.

- [ ] **Step 6: Print all-clear summary and proceed**

Print a one-line summary: "Pre-flight green: ssh taco ✓, vercel ✓, supabase ✓, gh ✓, clean tree ✓"

---

## Task 2: Add gitignore entries

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Read current .gitignore**

Run: `cat .gitignore`
Note current contents (do not duplicate entries).

- [ ] **Step 2: Append loop-state and secrets entries**

Append these lines to `.gitignore` (only if not already present):

```
# Overnight launch loop — runtime state, never committed
.loop-state/*
!.loop-state/.kept
!.loop-state/worker-prompt.template.md.example

# Local-only secrets the loop generates (keypairs, etc.)
secrets/*
!secrets/.kept
```

- [ ] **Step 3: Verify**

Run: `git check-ignore .loop-state/STATE.md secrets/treasury-mainnet.json`
Expected: both paths print (meaning they're ignored).

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "Ignore overnight launch loop runtime state + local secrets"
```

---

## Task 3: Create loop-state and secrets directory placeholders

**Files:**
- Create: `.loop-state/.kept`
- Create: `secrets/.kept`

- [ ] **Step 1: Create directories with placeholders**

```bash
mkdir -p .loop-state secrets
echo "Loop runtime state. Contents gitignored except this file. See docs/superpowers/specs/2026-05-09-overnight-launch-loop-design.md" > .loop-state/.kept
echo "Local-only secrets generated by the loop (keypairs). Contents gitignored. Never commit anything else here." > secrets/.kept
```

- [ ] **Step 2: Commit placeholders**

```bash
git add .loop-state/.kept secrets/.kept
git commit -m "Add loop-state and secrets directory placeholders"
```

---

## Task 4: Gather pre-kickoff decisions from the user

This is a single interactive checkpoint — collect ALL pending decisions in one batch so RUNBOOK.md can be written deterministically.

**Files:** none (note answers in conversation)

- [ ] **Step 1: Ask user, in one message, the following questions**

Ask all in one message via AskUserQuestion (or inline if AskUserQuestion is not preferred):

1. **Owner wallet pubkey** — the user's own Solana wallet pubkey (used for claiming the house agent + as the canonical owner identity).
2. **House agent intelligence** — `heuristic` (simple momentum: last-N-min Pyth price delta vs threshold) OR `llm` (Claude Sonnet 4.6 via Anthropic API). If `llm`, user provides `ANTHROPIC_API_KEY`.
3. **Rate-limit backend** — `upstash` (requires `UPSTASH_REDIS_REST_URL` + token) OR `supabase-table` (no extra service, simple table + per-(wallet, route) windowed counter). Default: `supabase-table`.
4. **Mainnet RPC URL** — paid provider URL OR fallback to `https://api.mainnet-beta.solana.com`. Default: fallback.
5. **Fixture-asker funding amount** — default 0.05 SOL on mainnet (≈ $10) — confirm or override.
6. **Per-fixture-run topup amount** — default 0.001 SOL (≈ $0.20) — confirm or override.

- [ ] **Step 2: Record answers in conversation context**

Note each answer; these go directly into RUNBOOK.md in Task 5.

---

## Task 5: Write RUNBOOK.md from collected decisions

**Files:**
- Create: `.loop-state/RUNBOOK.md`

- [ ] **Step 1: Write the file**

Create `.loop-state/RUNBOOK.md` with all 12 sections from the spec, populated with the user's answers from Task 4 plus the verbatim items already known:

```markdown
# RUNBOOK — pre-committed decisions for overnight launch loop workers

> **Workers must consult this file before asking any question. If a question is not
> covered here, choose the lowest-risk option and note the deviation in the report.**

## §1 Identity

- Owner wallet pubkey: <to be filled by user — SET BEFORE LOOP STARTS>
- Treasury devnet pubkey: GigzG9cDT2kamQRtkt6Njm4hXr2EFGRsL1NAGQ7RagSk
- Treasury mainnet pubkey: <generated in Phase 3 by a worker; written here after generation>

## §2 Mainnet config

- RPC URL: <user's answer from Task 4 Q3>
- Pyth Hermes base: https://hermes.pyth.network
- Mainnet feed IDs: workers verify each from https://pyth.network/developers/price-feed-ids before adding tokens. Confirmed list:
  - SOL/USD, BONK/USD, JUP/USD, WIF/USD, PYTH/USD, JTO/USD

## §3 Rate-limit choice

<from Task 4 Q2 — exact library and config>

## §4 Encryption-at-rest

AES-GCM with `WEBHOOK_MASTER_KEY` (32-byte hex, generated by Phase 1 worker, stored in Vercel Preview env scoped to feat/post-waitlist).

## §5 House agent

<from Task 4 Q1 — heuristic params OR LLM key reference>

## §6 E2E fixture amounts

- Per-run topup: <Q5 answer> lamports
- Fixture-asker initial fund: <Q4 answer> lamports

## §7 Fixture-asker wallet

- Pubkey: <generated in Task 6 — written here after generation>
- Keypair path: secrets/fixture-asker.json (gitignored, perms 0600)

## §8 ssh taco

- Host alias: taco (in user's ~/.ssh/config)
- Install path on taco: /opt/tradefish-house-agent
- Service unit: tradefish-house-agent.service
- Run user: tradefish (created by Phase 4 worker)

## §9 Don't-touch list (NEVER modify these from feat/post-waitlist)

- src/app/page.tsx
- src/app/layout.tsx
- src/app/opengraph-image.tsx
- src/app/api/waitlist/route.ts
- src/components/WaitlistForm.tsx
- src/components/HeroSwarm.tsx
- src/components/LightRays.tsx
- supabase/migrations/0002_waitlist.sql
- public/logo.png
- public/fonts/DepartureMono-Regular.woff2
- src/app/DepartureMono-Regular.otf
- src/app/logo-og.png

Workers MUST `git diff --name-only HEAD~1` after each commit and revert any commit that touches a file in this list. Mark the task `[!]` and continue.

## §10 Locked decisions (not up for re-litigation)

1. Agents register themselves via `/skill.md`. No HTML form.
2. Humans only need a Solana wallet — no email, no X verification.
3. `agents.owner_pubkey` IS identity. `owner_handle` is nullable cosmetic.
4. No seeded data. First registered agent populates the arena.
5. **Mainnet only** for the launch (overrides original "devnet only" decision).
6. **No merge to main from the loop.** Parallel session owns main. Loop generates `CUTOVER_RUNBOOK.md` for the human to execute. Branch boundary: `feat/post-waitlist` only.
7. v2 design system locked. Tokens in src/app/globals.css; surfaces in .claude/skills/tradefish-design/.

## §11 Stuck-task escalation

- 3 retries on the same task before marking `[!]`.
- Skipped `[!]` tasks listed in `BLOCKED.md` for human review.
- Loop terminates when all NON-blocked tasks done, or all remaining tasks are `[!]`.

## §12 Termination signature

The orchestrator writes `LAUNCH_DONE.md` ONLY when ALL of:
- All STATE.md tasks are `[x]` or `[!]`
- `npm run launch:verify --target=<staging URL>` returns exit code 0 (parsed from `.loop-state/last-verify.json`)
- `CUTOVER_RUNBOOK.md` exists at repo root
```

- [ ] **Step 2: Verify**

Run: `wc -l .loop-state/RUNBOOK.md && grep -c "^## §" .loop-state/RUNBOOK.md`
Expected: substantial (≥80 lines); 12 sections.

(Not committed — `.loop-state/` is gitignored.)

---

## Task 6: Write the keypair generator script and run it

**Files:**
- Create: `scripts/keys/generate-fixture-asker.ts`

- [ ] **Step 1: Write the script**

```typescript
// scripts/keys/generate-fixture-asker.ts
// One-shot: generate a fixture-asker keypair, write to secrets/fixture-asker.json
// (gitignored, perms 0600), print pubkey for the user to fund.

import { Keypair } from "@solana/web3.js";
import { writeFileSync, chmodSync, existsSync } from "node:fs";
import { mkdirSync } from "node:fs";

const OUT = "secrets/fixture-asker.json";

if (existsSync(OUT)) {
  console.error(`ERROR: ${OUT} already exists. Refusing to overwrite. Delete it manually if you really want a new one.`);
  process.exit(1);
}

mkdirSync("secrets", { recursive: true });
const kp = Keypair.generate();
writeFileSync(OUT, JSON.stringify(Array.from(kp.secretKey)));
chmodSync(OUT, 0o600);

console.log(JSON.stringify({
  pubkey: kp.publicKey.toBase58(),
  path: OUT,
  next_step: "Send the funding amount (see RUNBOOK §6) on mainnet to this pubkey, then confirm before the loop starts."
}, null, 2));
```

- [ ] **Step 2: Add `loop:keygen` script to package.json**

Modify `package.json` `scripts` block to add:

```json
"loop:keygen": "tsx scripts/keys/generate-fixture-asker.ts"
```

- [ ] **Step 3: Run the keygen**

Run: `npm run loop:keygen`
Expected: prints `{ pubkey: "...", path: "secrets/fixture-asker.json", next_step: "..." }`. File `secrets/fixture-asker.json` exists with mode 0600.

- [ ] **Step 4: Update RUNBOOK.md §7 with the pubkey**

Edit `.loop-state/RUNBOOK.md` to replace `<generated in Task 6 — written here after generation>` with the actual pubkey from Step 3.

- [ ] **Step 5: Show user the funding instruction**

Print: "Please send <X> SOL on MAINNET to <pubkey>. Reply 'funded' when done. Do NOT proceed past this checkpoint until the user confirms."
Wait for user confirmation.

- [ ] **Step 6: Commit the keygen script (NOT the keypair)**

```bash
git add scripts/keys/generate-fixture-asker.ts package.json
git commit -m "Add fixture-asker keypair generator for overnight loop"
```

Verify keypair did NOT get staged: `git status --short` should show no `secrets/` files.

---

## Task 7: Write launch-verify shared types

**Files:**
- Create: `scripts/launch-verify/types.ts`

- [ ] **Step 1: Write the file**

```typescript
// scripts/launch-verify/types.ts

export type CheckResult = {
  name: string;
  pass: boolean;
  detail: string;
  duration_ms: number;
};

export type Check = {
  name: string;
  run: (target: string) => Promise<Omit<CheckResult, "name" | "duration_ms">>;
};

export type VerifyReport = {
  target: string;
  ran_at: string;
  exit_code: 0 | 1;
  results: CheckResult[];
};
```

- [ ] **Step 2: No test — pure types, no runtime behavior**

(Vitest infers types; no behavioral test needed for type-only files.)

---

## Task 8: Write launch-verify runner

**Files:**
- Create: `scripts/launch-verify/run.ts`
- Create: `scripts/launch-verify/__tests__/run.test.ts`

- [ ] **Step 1: Write the failing test first**

```typescript
// scripts/launch-verify/__tests__/run.test.ts
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
```

- [ ] **Step 2: Run the test, see it fail**

Run: `npx vitest run scripts/launch-verify/__tests__/run.test.ts`
Expected: FAIL — module `../run` does not exist.

- [ ] **Step 3: Implement the runner**

```typescript
// scripts/launch-verify/run.ts
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
```

- [ ] **Step 4: Run test, see it pass**

Run: `npx vitest run scripts/launch-verify/__tests__/run.test.ts`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add scripts/launch-verify/types.ts scripts/launch-verify/run.ts scripts/launch-verify/__tests__/run.test.ts
git commit -m "Add launch-verify runner with TDD coverage"
```

---

## Task 9: Write the build-hygiene check (concrete check #1)

**Files:**
- Create: `scripts/launch-verify/checks/build-hygiene.ts`

- [ ] **Step 1: Write the check**

```typescript
// scripts/launch-verify/checks/build-hygiene.ts
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
```

- [ ] **Step 2: No vitest test for this — it shells out to actual build, which is too slow for a unit test**

The integration "test" is the verify run itself in Task 11.

---

## Task 10: Write the 11 stub checks

**Files:**
- Create: `scripts/launch-verify/checks/stubs.ts`

- [ ] **Step 1: Write all stubs**

```typescript
// scripts/launch-verify/checks/stubs.ts
// Workers replace each stub with a real check during Phase 6.
// Until replaced, each returns FAIL — this is what gates loop termination.

import type { Check } from "../types";

const stub = (name: string, what: string): Check => ({
  name,
  run: async () => ({
    pass: false,
    detail: `STUB — not yet implemented: ${what}. Phase 6 worker must replace this.`,
  }),
});

export const stubChecks: Check[] = [
  stub("migrations-applied",       "all supabase/migrations/*.sql present in linked project"),
  stub("preview-env-vars",         "all required Vercel Preview env vars set on feat/post-waitlist"),
  stub("mainnet-readiness",        "RPC reachable + treasury resolves + min balance + Pyth feeds valid"),
  stub("rate-limiting",            "rate-limit middleware present on /api/queries, /api/agents/register, /api/credits/topup"),
  stub("webhook-security",         "per-agent webhook secret encrypted at rest + HMAC verified on dispatch"),
  stub("settlement-cron",          "/api/settle authenticated by SETTLEMENT_CRON_SECRET + cron scheduled"),
  stub("house-agent-live",         "ssh taco reachable + house agent claimed + systemd active + last_response_at fresh"),
  stub("e2e-fixture-pass",         "npm run e2e:fixture exits 0 against staging"),
  stub("cutover-runbook-present",  "CUTOVER_RUNBOOK.md exists at repo root with manual cutover steps"),
  stub("staging-smoke",            "/arena, /agents, /ask, /docs, /terms each return 200; no console errors"),
  stub("empty-state-honesty",      "no scripts/seed-*.ts file exists in repo"),
];
```

- [ ] **Step 2: Verify count**

Run: `grep -c "^  stub(" scripts/launch-verify/checks/stubs.ts`
Expected: 11.

---

## Task 11: Write the launch-verify entry point

**Files:**
- Create: `scripts/launch-verify/index.ts`

- [ ] **Step 1: Write the entry point**

```typescript
// scripts/launch-verify/index.ts
// Usage: npm run launch:verify -- --target=<URL>
//   Writes structured report to .loop-state/last-verify.json
//   Exits 0 if all checks pass, 1 otherwise.

import { writeFileSync, mkdirSync } from "node:fs";
import { runChecks } from "./run";
import { buildHygiene } from "./checks/build-hygiene";
import { stubChecks } from "./checks/stubs";

function parseTarget(): string {
  const arg = process.argv.find(a => a.startsWith("--target="));
  if (!arg) {
    console.error("ERROR: --target=<URL> is required");
    process.exit(2);
  }
  return arg.slice("--target=".length);
}

async function main() {
  const target = parseTarget();
  const allChecks = [buildHygiene, ...stubChecks];
  const report = await runChecks(target, allChecks);

  mkdirSync(".loop-state", { recursive: true });
  writeFileSync(".loop-state/last-verify.json", JSON.stringify(report, null, 2));

  console.log(`\nlaunch-verify @ ${target}`);
  for (const r of report.results) {
    const mark = r.pass ? "✓" : "✗";
    console.log(`  ${mark} ${r.name.padEnd(30)} ${r.detail}`);
  }
  const passed = report.results.filter(r => r.pass).length;
  console.log(`\n${passed}/${report.results.length} checks passed. exit ${report.exit_code}.`);

  process.exit(report.exit_code);
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Add `launch:verify` to package.json**

Modify `package.json` `scripts` block to add:

```json
"launch:verify": "tsx scripts/launch-verify/index.ts"
```

- [ ] **Step 3: Run it (expect FAIL — most checks are stubs)**

Run: `npm run launch:verify -- --target=https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app`
Expected: prints all 12 check results — `build-hygiene` may pass or fail depending on current state, the 11 stubs all FAIL with "STUB — not yet implemented". Exit code 1. `.loop-state/last-verify.json` written.

- [ ] **Step 4: Verify the JSON output**

Run: `cat .loop-state/last-verify.json | head -20`
Expected: structured `{ target, ran_at, exit_code: 1, results: [...] }`.

- [ ] **Step 5: Commit**

```bash
git add scripts/launch-verify/checks/build-hygiene.ts scripts/launch-verify/checks/stubs.ts scripts/launch-verify/index.ts package.json
git commit -m "Add launch-verify entry, 1 real check, 11 stubs"
```

---

## Task 12: Write e2e-fixture skeleton

**Files:**
- Create: `scripts/e2e-fixture/index.ts`

- [ ] **Step 1: Write the skeleton**

```typescript
// scripts/e2e-fixture/index.ts
// Skeleton — Phase 5 worker fills in each step.
// Asserts: register → claim → topup → ask → respond → settle → teardown.
// Returns exit 0 on green, 1 on any failure.

async function main() {
  const STEPS = [
    "register-ephemeral-agent",
    "claim-with-wallet-sig",
    "topup-from-fixture-asker",
    "submit-query",
    "ephemeral-agent-responds",
    "fast-settle-via-test-mode",
    "assert-db-state",
    "teardown-ephemeral-agent",
  ];
  console.error("FIXTURE NOT YET IMPLEMENTED — Phase 5 worker must replace this skeleton.");
  console.error("Steps required:");
  for (const s of STEPS) console.error(`  - [ ] ${s}`);
  process.exit(1);
}

main();
```

- [ ] **Step 2: Add `e2e:fixture` to package.json**

Modify `package.json` `scripts` block to add:

```json
"e2e:fixture": "tsx scripts/e2e-fixture/index.ts"
```

- [ ] **Step 3: Run it (expect FAIL — it's a skeleton)**

Run: `npm run e2e:fixture`
Expected: prints the 8-step checklist, exits 1.

- [ ] **Step 4: Commit**

```bash
git add scripts/e2e-fixture/index.ts package.json
git commit -m "Add e2e-fixture skeleton for Phase 5 worker"
```

---

## Task 13: Write the worker prompt template

**Files:**
- Create: `.loop-state/worker-prompt.template.md`

- [ ] **Step 1: Write the template**

```markdown
# Worker prompt template (orchestrator interpolates {{...}} variables per tick)

You are worker for tick {{TICK_N}} of the overnight launch loop.

**Required first reads (in this order):**
1. `tradefish-platform/.loop-state/RUNBOOK.md` — pre-committed decisions; ALL of them apply
2. `tradefish-platform/.loop-state/STATE.md` — current task list and status
3. `tradefish-platform/AGENT_HANDOFF.md` — project context

**Your task this tick:** {{TASK_DESCRIPTION}}

**Hard constraints (workers that violate these are reverted):**
- Stay on branch `feat/post-waitlist`. Never `git checkout`, `git merge`, `git push origin main`, or modify any other ref.
- Never modify Vercel Production env vars. Preview env scoped to feat/post-waitlist is fine.
- Never modify any file in RUNBOOK §9 don't-touch list. After every commit, run `git diff --name-only HEAD~1` and revert if any don't-touch file changed.
- Never invent decisions a human would make. Consult RUNBOOK first; if not covered, choose the lowest-risk option AND note the deviation in your report.
- Commit on success on feat/post-waitlist. Never push to remotes other than feat/post-waitlist.

**Tools you may use:** Bash, Edit, Write, Read, Agent (for spawning your own helpers like Plan or code-reviewer).

**Report contract (≤500 words, structured):**
1. Outcome: `done` | `partial` | `failed`
2. Files touched (paths)
3. Commands run (one-liners)
4. Test results (counts of pass/fail)
5. Any deviation from RUNBOOK and why
6. Next-suggestion: what should the orchestrator queue next?

Begin work now. Stop and report when the task is done or a hard blocker is reached.
```

- [ ] **Step 2: Verify**

Run: `wc -l .loop-state/worker-prompt.template.md`
Expected: ~30 lines.

(Not committed — `.loop-state/` is gitignored.)

---

## Task 14: Write STATE.md initial phase plan

**Files:**
- Create: `.loop-state/STATE.md`

- [ ] **Step 1: Write the file**

```markdown
# STATE — overnight launch loop

**Branch:** feat/post-waitlist
**Started:** <ISO timestamp on first tick>
**Tick counter:** 0
**Last verify:** none yet
**Status:** awaiting first tick

## Phase 1 — Backend hardening (no UI, no mainnet yet) [phase-status: not-started]

- [ ] add rate-limit middleware to /api/queries, /api/agents/register, /api/credits/topup per RUNBOOK §3
- [ ] add migration for per-agent webhook_secret_encrypted (AES-GCM via WEBHOOK_MASTER_KEY)
- [ ] HMAC verify on /api/internal/dispatch using per-agent secret
- [ ] enforce SETTLEMENT_CRON_SECRET on /api/settle
- [ ] idempotency audit on /api/queries/[id]/respond + verify refund-on-failure
- [ ] structured error logging audit across API routes
- [ ] add SETTLE_TEST_MODE flag to /api/settle (non-prod only) for fast-settle in fixture

## Phase 2 — UX completeness (parallel to Phase 1) [phase-status: not-started]

- [ ] empty / loading / error states audit for every async surface
- [ ] mobile responsive sweep + Phantom mobile deep-link verify
- [ ] sync /docs page with current API
- [ ] sync src/content/skill.md with current API
- [ ] add /terms page (paper-trading disclaimer)
- [ ] style 404 + 500 pages per v2 design
- [ ] per-route OG images for platform routes (root OG is don't-touch)

## Phase 3 — Mainnet code paths (depends on Phase 1) [phase-status: not-started]

- [ ] generate mainnet treasury keypair locally → ~/Documents/tradefish-mainnet-treasury.txt perms 0600; write pubkey to RUNBOOK §1
- [ ] add NEXT_PUBLIC_SOLANA_NETWORK switch + per-network RPC + treasury reads
- [ ] verify supported-token Pyth mainnet feed IDs via Hermes
- [ ] vercel env add — set Preview env scoped to feat/post-waitlist for mainnet RPC + treasury + WEBHOOK_MASTER_KEY + SETTLEMENT_CRON_SECRET + INTERNAL_WEBHOOK_HMAC_SECRET
- [ ] redeploy preview on feat/post-waitlist; smoke test staging URL with mainnet config

## Phase 4 — House agent on ssh taco (depends on Phase 3) [phase-status: not-started]

- [ ] ssh taco; install node + dependencies; create tradefish user; mkdir -p /opt/tradefish-house-agent
- [ ] generate house agent Solana keypair on taco; fund with ~0.01 SOL mainnet for fees
- [ ] write house agent code per RUNBOOK §5 (heuristic OR LLM); deploy to /opt/tradefish-house-agent
- [ ] systemd unit tradefish-house-agent.service with Restart=always; enable + start
- [ ] register house agent against staging URL via /skill.md flow; claim via wallet sig
- [ ] verify: house agent answers a test query within 30s of submission

## Phase 5 — E2E fixture rig (depends on Phases 1 + 4) [phase-status: not-started]

- [ ] replace scripts/e2e-fixture/index.ts skeleton with real implementation per RUNBOOK §6 + §7
- [ ] verify: npm run e2e:fixture exits 0 against staging URL with mainnet config
- [ ] verify teardown: ephemeral fixture agent's DB row is gone after run

## Phase 6 — launch-verify final form (depends on all above) [phase-status: not-started]

- [ ] replace migrations-applied stub with real check
- [ ] replace preview-env-vars stub with real check
- [ ] replace mainnet-readiness stub with real check
- [ ] replace rate-limiting stub with real check
- [ ] replace webhook-security stub with real check
- [ ] replace settlement-cron stub with real check
- [ ] replace house-agent-live stub with real check (SSHs to taco for systemd status + last_response_at)
- [ ] replace e2e-fixture-pass stub with real check (shells out to npm run e2e:fixture)
- [ ] replace cutover-runbook-present stub with real check (just `existsSync("CUTOVER_RUNBOOK.md")`)
- [ ] replace staging-smoke stub with real check (curl + DOM marker assertions)
- [ ] replace empty-state-honesty stub with real check (`!existsSync("scripts/seed-*.ts")`)

## Phase 7 — Cutover runbook generation (depends on Phases 1-6 green) [phase-status: not-started]

- [ ] write CUTOVER_RUNBOOK.md at repo root with the 11-step manual cutover (see spec)
- [ ] commit CUTOVER_RUNBOOK.md to feat/post-waitlist

## Phase 8 — Final verification on staging (depends on Phase 7) [phase-status: not-started]

- [ ] run npm run launch:verify --target=<staging URL>; assert exit 0
- [ ] write LAUNCH_DONE.md with summary of work done, files touched, ticks used
- [ ] STOP — orchestrator exits, no further wakeups

---

## Blockers

(none yet)

## Tick log pointer

See `.loop-state/TICK_LOG.md` for per-tick history.
```

- [ ] **Step 2: Verify**

Run: `grep -c "^- \[ \]" .loop-state/STATE.md`
Expected: ~38 task checkboxes across all phases.

(Not committed — `.loop-state/` is gitignored.)

---

## Task 15: Initialize empty TICK_LOG.md

**Files:**
- Create: `.loop-state/TICK_LOG.md`

- [ ] **Step 1: Initialize**

```bash
echo "# Tick log — append-only, one line per tick" > .loop-state/TICK_LOG.md
echo "# Format: [TICK NNN | TIMESTAMP | worker=name | result=green/red/partial | ctx=NK]" >> .loop-state/TICK_LOG.md
echo "" >> .loop-state/TICK_LOG.md
```

- [ ] **Step 2: Verify**

Run: `cat .loop-state/TICK_LOG.md`
Expected: header lines, empty body.

---

## Task 16: Final pre-kickoff sanity check

**Files:** none (read-only assertions)

- [ ] **Step 1: Verify all infra files exist**

Run:
```bash
test -f .loop-state/STATE.md && echo "STATE.md ✓" || echo "STATE.md ✗"
test -f .loop-state/RUNBOOK.md && echo "RUNBOOK.md ✓" || echo "RUNBOOK.md ✗"
test -f .loop-state/TICK_LOG.md && echo "TICK_LOG.md ✓" || echo "TICK_LOG.md ✗"
test -f .loop-state/worker-prompt.template.md && echo "worker-prompt.template.md ✓" || echo "✗"
test -f scripts/launch-verify/index.ts && echo "launch-verify ✓" || echo "✗"
test -f scripts/e2e-fixture/index.ts && echo "e2e-fixture ✓" || echo "✗"
test -f secrets/fixture-asker.json && echo "fixture-asker keypair ✓" || echo "✗"
```
Expected: all ✓.

- [ ] **Step 2: Verify launch-verify runs (will fail on stubs, that's correct)**

Run: `npm run launch:verify -- --target=https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app | tail -5`
Expected: prints `1/12 checks passed. exit 1.` (or similar — build-hygiene may also fail, that's fine).

- [ ] **Step 3: Verify branch + working tree**

Run: `git branch --show-current && git status --short`
Expected: `feat/post-waitlist`; status shows nothing tracked uncommitted (`.loop-state/` and `secrets/` are gitignored).

- [ ] **Step 4: Verify RUNBOOK pubkey filled in**

Run: `grep -A1 "^## §7" .loop-state/RUNBOOK.md | head -3`
Expected: shows the actual fixture-asker pubkey, not the placeholder.

- [ ] **Step 5: Verify mainnet treasury pubkey placeholder is still pending**

Run: `grep "Treasury mainnet pubkey" .loop-state/RUNBOOK.md`
Expected: `<generated in Phase 3 by a worker; written here after generation>` — this is correct; loop's Phase 3 fills it in.

- [ ] **Step 6: Confirm fixture-asker has been funded**

Ask user: "Confirm: has the fixture-asker wallet been funded with the agreed mainnet SOL? (yes/no)"
If no: STOP and wait for funding before proceeding to Task 17.

---

## Task 17: Trigger the autonomous loop

This is the final step. After this, the user is hands-off until morning.

**Files:** none (invokes /loop)

- [ ] **Step 1: Recommend the user run `/clear` first**

Tell the user:

> Phase 0 infra is complete and committed. To keep the orchestrator session as small as possible, I recommend running `/clear` and then starting the loop in a fresh session. Reply 'ready' to get the exact loop prompt to paste, or 'continue' to start the loop in this session (less ideal — context will be larger).

- [ ] **Step 2: Provide the /loop invocation prompt**

Print this prompt block — the user pastes it as the `/loop` argument:

```
Read tradefish-platform/.loop-state/STATE.md and tradefish-platform/.loop-state/RUNBOOK.md.

Pick the next [ ] task by phase order, respecting phase dependencies in STATE.md.
Mark the task [~] with the tick number.

Dispatch ONE general-purpose Agent subagent using the prompt template at
tradefish-platform/.loop-state/worker-prompt.template.md, interpolating the task
description. Demand a ≤500-word structured report.

On worker return:
- If outcome=done: mark task [x], append result to TICK_LOG.md
- If outcome=partial or failed: increment retry counter for the task; after 3 retries, mark [!] and write to .loop-state/BLOCKED.md
- Always append one line to TICK_LOG.md

Every 5th tick: dispatch a verification worker that runs
`npm run launch:verify --target=<staging URL>` and writes the structured result
to .loop-state/last-verify.json. Failures auto-spawn fix tasks tagged with the
failing check name.

Termination conditions (any one stops the loop):
- All STATE.md tasks are [x] or [!] AND .loop-state/last-verify.json shows exit_code=0 AND CUTOVER_RUNBOOK.md exists at repo root → write LAUNCH_DONE.md, stop.
- Tick counter ≥ 100 → write LOOP_TIMEOUT.md, stop.
- All remaining tasks are [!] (everything blocked) → write BLOCKED.md if not already, stop.
- Self-assessed degradation (parsing failures, repeated tool errors) → write rotation note, stop.

Otherwise: ScheduleWakeup(180s, this exact prompt).

Hard rails:
- Stay on feat/post-waitlist; never push to or modify main.
- Never modify Vercel Production env vars.
- Never modify any file in RUNBOOK §9 don't-touch list.
- Workers that violate hard rails: revert their commit, mark task [!], proceed.
```

- [ ] **Step 3: Done**

Plan execution is complete. The autonomous loop now runs until one of the termination conditions fires.

---

## Self-review

**Spec coverage check:**
- ✓ Goal — captured in plan goal section
- ✓ Acceptance criteria #1 (build-hygiene) — Task 9 + Task 11
- ✓ Acceptance criteria #2-12 (all others) — stubs in Task 10, Phase 6 in STATE.md replaces each
- ✓ Architecture (orchestrator + STATE + RUNBOOK + worker dispatch) — Tasks 5, 13, 14, 17
- ✓ Phase plan all 8 phases — encoded in STATE.md (Task 14)
- ✓ RUNBOOK 12 sections — Task 5
- ✓ Pre-kickoff items — Tasks 1, 4, 6, 16
- ✓ Run command — Task 17
- ✓ Risks (mainnet keypair, don't-touch, branch escape, prod env, fixture wallet, runaway, flaky verify, context exhaustion) — RUNBOOK §9 + §11 + worker prompt template hard rails + 100-tick cap encoded in Task 17 prompt

**Placeholder scan:** Searched for "TBD", "TODO", "fill in", "implement later", "appropriate", "etc." in the plan. The only TODO markers are:
- RUNBOOK §1 owner wallet pubkey is `<to be filled by user — SET BEFORE LOOP STARTS>` — this is intentional pre-kickoff input, not a TODO for the engineer; Task 4 should also collect it. **FIX:** add owner wallet pubkey collection to Task 4.
- RUNBOOK §1 mainnet treasury pubkey is filled in by Phase 3 worker — intentional, documented.

**Type consistency:** `Check`, `CheckResult`, `VerifyReport` defined in Task 7, used in Tasks 8/9/10/11 — consistent.

**Inline fix:** Add owner wallet pubkey question to Task 4.
