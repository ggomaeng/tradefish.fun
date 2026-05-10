# Overnight Launch Loop — Design Spec

> Brainstormed 2026-05-09. Status: design approved by user; awaiting implementation plan.

## Goal

Run an autonomous overnight `/loop` that brings the TradeFish post-waitlist platform to a state where, by morning:

- The platform is fully working on the **staging URL** with **mainnet-real-money paths green**.
- The house agent on `ssh taco` is registered, claimed, and answering queries against staging.
- A complete end-to-end flow has just been verified by an ephemeral fixture agent — register → claim → topup → ask → respond → settle — with no seeded data.
- A `CUTOVER_RUNBOOK.md` lists the exact manual steps for the human-driven flip from waitlist on `main` to platform on `main`.

The loop **never merges to `main`** and **never touches Production env vars**. Locked decision #6 ("don't merge to main unilaterally — parallel session owns it") is honored. The user flips the switch when ready.

## Non-goals

- Mobile-first redesign.
- Question types beyond `buy_sell_now`.
- A custom Solana program.
- SOC2-grade audit logging.
- Cookie banner / GDPR surface.
- Email collection.

## Acceptance criteria — `npm run launch:verify --target=<staging URL>` returns 0 only if all pass

The script is the loop's terminating condition. Each check returns `{ name, pass, detail }`; output is also written to `.loop-state/last-verify.json`.

1. **Build hygiene** — `npx tsc --noEmit`, `npm run build`, `npm test` all exit 0.
2. **Migrations applied** — All `supabase/migrations/*.sql` present in the linked Supabase project.
3. **Preview env vars set** — Vercel Preview env contains: mainnet RPC, mainnet treasury pubkey, supabase keys, settlement cron secret, internal webhook HMAC, webhook master key, OPENAI_API_KEY (for wiki), all required keys present.
4. **Mainnet readiness** — RPC reachable; treasury pubkey resolves; treasury has minimum SOL balance (configurable, default ≥ 0.01 SOL); all supported-token Pyth mainnet feed IDs return valid prices via Hermes.
5. **Rate limiting** — Audit confirms middleware on `/api/queries`, `/api/agents/register`, `/api/credits/topup` (10 RPM per wallet/IP).
6. **Webhook security** — Per-agent webhook secret encrypted at rest (AES-GCM); HMAC verified on dispatch.
7. **Settlement cron** — Authenticated by `SETTLEMENT_CRON_SECRET`; scheduled in `vercel.json`; last run timestamp within window.
8. **House agent live** — `ssh taco` reachable; house agent DB row has `claimed=true`; the agent process is `active (running)` per systemd; `last_response_at` within window.
9. **E2E fixture pass** — `npm run e2e:fixture` exits 0 against staging: ephemeral agent registers → owner claims via wallet sig → fixture asker tops up small mainnet SOL → submits query → ephemeral agent responds → settle stub-advances → all DB rows + event log lines verified → fixture agent torn down (DELETE row).
10. **Cutover runbook present** — `CUTOVER_RUNBOOK.md` exists at repo root with copy-pasteable manual steps.
11. **Live mainnet smoke against staging URL** — `/arena`, `/agents`, `/ask`, `/docs`, `/terms` each return 200; no console errors; expected DOM markers present.
12. **Empty-state honesty** — No `scripts/seed-*.ts` exists; arena's first activity comes from real fixture/house-agent flow, not mocks.

## Architecture

```
You (sleeping)
   │
   └─▶ /loop (self-paced, dynamic mode) — orchestrator session
          │
          ├─ reads .loop-state/STATE.md         ← durable plan + status
          ├─ reads .loop-state/RUNBOOK.md       ← pre-baked decisions, no questions
          ├─ dispatches ONE Agent subagent      ← worker (general-purpose type)
          │     └─ does code/test/deploy work, returns ≤500-word report
          ├─ writes report → STATE.md
          ├─ if STATE complete && verify=green → exit
          └─ else ScheduleWakeup(180s, same /loop prompt)
```

### Files (under `tradefish-platform/.loop-state/`, gitignored)

| File | Purpose | Owner |
|---|---|---|
| `STATE.md` | Phase plan + per-task status (`[ ]/[~]/[x]/[!]`) + last verify result + tick counter + blockers | orchestrator writes, workers read |
| `RUNBOOK.md` | Pre-committed answers to anything a worker might want to ask | hand-written before kickoff, immutable during run |
| `TICK_LOG.md` | One-line append per tick: `[TICK 042 \| 03:14 UTC \| worker=fix-rate-limit \| result=green \| ctx=42K]` | orchestrator appends |
| `BLOCKED.md` | Created only if a task is stuck after retries | orchestrator creates if needed |
| `LAUNCH_DONE.md` | Created when all phases complete and `launch:verify` returns 0 | orchestrator creates on success |
| `LOOP_TIMEOUT.md` | Created if 100-tick cap reached | orchestrator creates on timeout |
| `last-verify.json` | Latest structured verify output | written by verify script |

### Orchestrator behavior per tick

1. Read `STATE.md` (target: <2K tokens — keep it terse).
2. Decide next action by priority:
   - If unread blockers exist that prevent progress → write `BLOCKED.md`, stop.
   - If all phases complete AND `last-verify.json.exit_code == 0` → write `LAUNCH_DONE.md`, stop.
   - If tick counter >= 100 → write `LOOP_TIMEOUT.md`, stop. (This is the deterministic rotation trigger; auto-compaction handles long-tail growth before that.)
   - If self-assessed degradation observed (orchestrator can't reliably parse STATE.md, repeated tool errors) → write rotation note, stop.
   - Else: pick the next `[ ]` task respecting phase dependencies, mark `[~]`, dispatch worker.
3. Dispatch via `Agent(subagent_type=general-purpose)` with prompt template:
   ```
   You are worker for tick {N}. Read RUNBOOK.md and STATE.md (in tradefish-platform/.loop-state/).
   Your task: {task description}
   Constraints:
     - Don't touch any file in the don't-touch list (RUNBOOK §9).
     - Stay on feat/post-waitlist; never checkout, merge, or push to main.
     - Never modify Vercel Production env vars.
     - Commit on success on feat/post-waitlist; do NOT push to remotes other than feat/post-waitlist.
     - On any decision a human would make, consult RUNBOOK. If RUNBOOK doesn't cover it, choose lowest-risk and note it in the report.
     - Report ≤500 words: outcome, files touched, commands run, any deviation from RUNBOOK.
   ```
4. Receive report; update STATE.md task to `[x]` (success) or increment retry counter (failure); append TICK_LOG.md.
5. ScheduleWakeup(180s, /loop prompt) — unless terminating.

### Verification worker

Every Nth tick (default every 5), the orchestrator dispatches a verify worker that runs `npm run launch:verify --target=<staging URL>` and writes `last-verify.json`. Failures auto-spawn fix tasks in STATE.md tagged with the failing check name.

### Worker tool budget

Workers have full tool access — Bash, Edit, Write, Read, Agent (for spawning their own helpers). They commit on green; they do not push to remote refs other than `feat/post-waitlist`.

### Stuck-loop handling

Each task has a retry counter. After 3 failed attempts, it's marked `[!]` (blocked), the orchestrator skips it, and the run terminates as soon as all NON-blocked tasks are done OR everything is blocked. `BLOCKED.md` lists what needs human attention.

### Context hygiene

- Per-tick orchestrator footprint capped at ~5K tokens (STATE.md read, one Agent dispatch, ≤500-word report, STATE.md write, ScheduleWakeup).
- Worker subagents run in isolated context windows; their work doesn't pollute the orchestrator.
- Auto-compaction handles long-tail growth (Opus 4.7 1M context).
- Hard rotation triggers: 100-tick cap (deterministic), or self-assessed degradation (heuristic).
- STATE.md and RUNBOOK.md live in `.loop-state/` which is gitignored. The orchestrator updates STATE.md without committing; workers commit only code changes.

## Phase plan

The loop's STATE.md is initialized with these phases. Tasks within a phase can run in any order; phases serialize on the marked dependencies.

### Phase 0 — Loop infra (done in pre-kickoff session, not by the loop)

- Write STATE.md skeleton, RUNBOOK.md, scripts/launch-verify.ts skeleton.
- Verify `ssh taco` reachable, Vercel CLI auth, Supabase CLI linked, `gh` auth.
- Generate fixture-asker keypair; user funds it with ~0.05 SOL mainnet.
- Commit infra to `feat/post-waitlist`.

### Phase 1 — Backend hardening (no UI, no mainnet yet)

- Rate limiting on `/api/queries`, `/api/agents/register`, `/api/credits/topup` (per RUNBOOK choice).
- Per-agent webhook secret encryption at rest (new migration; AES-GCM with `WEBHOOK_MASTER_KEY`).
- HMAC verification on `/api/internal/dispatch` using per-agent secret.
- Enforce `SETTLEMENT_CRON_SECRET` on `/api/settle`.
- Idempotency audit on `/api/queries/[id]/respond`; refund-on-failure verified.
- Structured error logging audit across API routes.
- Add `SETTLE_TEST_MODE` to `/api/settle`: when present + authenticated + on non-prod URL, accept an explicit `as_of_ts` parameter so the E2E fixture can fast-settle without waiting 1h. Production never honors this flag.

### Phase 2 — UX completeness (parallel to Phase 1)

- Empty / loading / error states on every async surface.
- Mobile responsive pass; Phantom mobile deep-link verified.
- `/docs` page synced to current API.
- `/skill.md` synced to current API.
- `/terms` page (paper-trading disclaimer, no investment advice).
- Styled 404 and 500 pages.
- Per-route OG images for platform routes (root OG is don't-touch).

### Phase 3 — Mainnet code paths (depends on Phase 1)

- Generate mainnet treasury keypair → `~/Documents/tradefish-mainnet-treasury.txt`, perms 0600.
- Add `NEXT_PUBLIC_SOLANA_NETWORK` switch; ensure code reads RPC + treasury per-network.
- Verify supported-token Pyth mainnet feed IDs via Hermes.
- Set Vercel Preview env to mainnet, **scoped to `feat/post-waitlist`** so other branches' previews are unaffected (`vercel env add KEY preview feat/post-waitlist`). Production env stays untouched.
- Run E2E fixture on staging-with-mainnet using small lamport amount per RUNBOOK.

### Phase 4 — House agent on `ssh taco` (depends on Phase 3)

- Provision: Node, dependencies, systemd unit `tradefish-house-agent.service`.
- Generate house agent Solana keypair (separate from treasury); fund with small SOL for fees.
- Build agent: poll `/api/queries/pending`, decide via RUNBOOK heuristic (or LLM if API key provided), respond.
- Register against staging; verify claim+respond.
- `Restart=always`; health log file the verify script can scrape over SSH.

### Phase 5 — E2E fixture rig (depends on Phases 1 + 4)

- `scripts/e2e-fixture.ts`: spins up ephemeral fresh agent on taco distinct from house agent.
- Asker wallet: fixture mainnet keypair (RUNBOOK lists pubkey + balance check).
- Asserts: register → claim → topup → ask → respond → settle (uses `SETTLE_TEST_MODE` from Phase 1 to fast-settle).
- Tear down fixture agent at end (DELETE row).
- `npm run e2e:fixture` returns 0 on green.

### Phase 6 — `npm run launch:verify` final form (depends on all above)

- Each acceptance criterion → discrete check returning `{ name, pass, detail }`.
- One exit code; structured JSON written to `.loop-state/last-verify.json`.

### Phase 7 — Cutover runbook generation (depends on Phases 1–6 green)

No merge, no auto-deploy. Loop generates `CUTOVER_RUNBOOK.md` at repo root with the exact manual flip:

```
1. Coordinate with parallel session on main.
2. vercel env add NEXT_PUBLIC_SOLANA_RPC production    (mainnet RPC)
3. vercel env add NEXT_PUBLIC_TRADEFISH_TREASURY production    (<mainnet pubkey>)
4. gh pr create --base main --head feat/post-waitlist
5. Wait for parallel-session review + approval.
6. gh pr merge --squash
7. Watch Vercel deploy → tradefish.fun
8. npm run launch:verify --target=https://tradefish.fun
9. ssh taco; sudo systemctl edit tradefish-house-agent → BASE_URL=https://tradefish.fun
10. sudo systemctl restart tradefish-house-agent
11. Confirm house agent answers a fresh query on prod.
```

### Phase 8 — Final verification on staging (depends on Phase 7)

- Run `npm run launch:verify --target=<staging URL>` once more, all green.
- Write `LAUNCH_DONE.md` summarizing what was done, files touched, ticks used, suggested next steps.
- Stop the loop.

### Time estimate

Upper bound ~50 ticks × 3 min = ~2.5 hours of work, ~3–4 hours wall clock. Comfortably inside an overnight window.

## RUNBOOK.md sections (full list)

1. Identity — owner wallet pubkey, treasury devnet pubkey, treasury mainnet pubkey
2. Mainnet config — RPC URL, Pyth Hermes base, supported-token mainnet feed IDs
3. Rate-limit choice — Upstash or Supabase-table (loop picks one)
4. Encryption-at-rest choice — AES-GCM with `WEBHOOK_MASTER_KEY`
5. House agent design — heuristic specifics OR `ANTHROPIC_API_KEY` for LLM
6. E2E fixture amounts — exact lamport amount per topup test
7. Fixture-asker wallet — pubkey + keypair path
8. `ssh taco` access — config + paths on taco
9. Don't-touch list — copied verbatim from memory
10. Locked decisions — copied from memory; #6 affirmed (no merge to main)
11. Stuck-task escalation — 3 retries, `[!]`, keep going
12. Termination signature — `LAUNCH_DONE.md` only when verify exits 0 AND `CUTOVER_RUNBOOK.md` exists

## Pre-kickoff items the user does

1. Confirm `ssh taco` works (probe `ssh taco "uname -a"`).
2. Decide LLM-vs-heuristic house agent. If LLM, provide `ANTHROPIC_API_KEY`.
3. Fund the fixture-asker wallet with ~0.05 SOL on mainnet.
4. Sanity check: `vercel whoami`, `supabase projects list`, `gh auth status`. Re-auth anything stale.
5. Allow snapshot commit of `.loop-state/` skeleton + verify script skeleton on a clean `feat/post-waitlist` HEAD.

## Run command

After pre-kickoff is complete:

```
/loop  (no interval — self-paced dynamic mode)
```

with the prompt:

```
Read tradefish-platform/.loop-state/STATE.md and RUNBOOK.md.
Pick the next [ ] task by phase order. Mark it [~]. Dispatch a single
general-purpose Agent with the task + RUNBOOK.md path + don't-touch
list, asking for ≤500-word report. On return, mark [x] or increment
retry; append TICK_LOG.md. If all phases done AND launch-verify green,
write LAUNCH_DONE.md and stop. If context >80%, write rotation note
and stop. If tick >= 100, write LOOP_TIMEOUT.md and stop. Else
ScheduleWakeup(180s, this same prompt).
```

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Mainnet keypair generated by autonomous agent | Generated locally (not on taco), saved to `~/Documents/tradefish-mainnet-treasury.txt` perms 0600, base64 backup. Worker only commits the pubkey. |
| Fixture wallet on mainnet sending small SOL repeatedly | Capped per RUNBOOK at one fixture run total; verify script asserts no extra topups beyond N. |
| Loop modifies don't-touch files | Worker prompt includes the list + a `git diff` check before commit; commits touching the list are reverted with `[!]`. |
| Loop escapes `feat/post-waitlist` | Worker prompts forbid checkout/merge/push to other refs; orchestrator state machine has no path to `git push origin main`. |
| Vercel Production env modified | RUNBOOK forbids it; verify script asserts production env unchanged from kickoff snapshot. |
| House agent wallet on taco compromised | House agent wallet is distinct from treasury, funded with ~0.01 SOL only. Worst case loses ~$2. |
| Loop runs forever | Hard cap of 100 ticks; if reached, write `LOOP_TIMEOUT.md` and stop. |
| Verify script flaky | Each check is independent + has its own retry; flaky checks (network) get 3 retries before failing. |
| Worker context exhaustion | Each worker is a fresh Agent dispatch; their context dies on return. |
| Orchestrator context exhaustion | Per-tick budget ~5K tokens; auto-compaction; hard rotation at 80%. |

## Open questions for the implementation plan

- Concrete rate-limit library choice (Upstash vs Supabase-table) — settle in RUNBOOK pre-kickoff.
- House agent: heuristic vs LLM — user decides pre-kickoff.
- Exact fixture-asker funding amount — RUNBOOK default is 0.05 SOL; confirmed pre-kickoff.
- Whether to write `vitest` integration tests for new rate-limit + webhook-encryption code (recommended yes; the implementation plan should include them).

## Next step

Hand to writing-plans skill to produce the executable implementation plan.
