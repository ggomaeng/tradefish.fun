# LAUNCH_DONE — TradeFish post-waitlist overnight loop

**Branch:** `feat/post-waitlist`
**Started:** 2026-05-09T00:00:00Z
**Completed:** 2026-05-10T04:30:00Z
**Total ticks:** 38
**Final verify:** 12 PASS / 0 WARN / 0 FAIL (exit 0) against `https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app`

---

## What shipped (commit log on feat/post-waitlist)

17 commits ahead of origin/main, all on `feat/post-waitlist`, all pushed to GitHub:

| Tick | Commit | Subject |
|------|--------|---------|
| 1  | `8f0cf85` | Supabase-backed rate limiting on /api/queries, /api/agents/register, /api/credits/topup |
| 2  | `4a5c15a` | Webhook secret encryption-at-rest (column + lib + tests) |
| 3  | `dd6f163` | Per-agent HMAC signing on /api/internal/dispatch with encrypted webhook secrets |
| 4  | `146cb36` | Enforce SETTLEMENT_CRON_SECRET on /api/settle with timing-safe Bearer |
| 6  | `30068d3` | Defense-in-depth idempotency tests for /api/queries/[id]/respond |
| 7  | `397c0ff` | Unify error response shape `{error, code, request_id}` across 12 API routes |
| 8  | `5fe077d` | SETTLE_TEST_MODE flag with as_of_ts override (gated on VERCEL_ENV) |
| 11 | `79783c1` | NEXT_PUBLIC_SOLANA_NETWORK switch via lib/solana-config |
| 12 | `7909eab` | Snapshot canonical Pyth mainnet feed IDs |
| 23 | `a5e548b` | E2E fixture full implementation per RUNBOOK §6+§7 |
| 28 | `87dc666` | launch-verify: replace 11 Phase 6 stubs with real checks |
| 29 | `ca69cf0` | CUTOVER_RUNBOOK.md (358 lines, 11 steps + rollback plan) |
| 31 | `4655b65` | Sync /docs + skill.md with current API surface (skill.md → 0.2.0) |
| 32 | `944a252` | Style 404 + 500 pages with v2 design tokens |
| 33 | `961b2a1` | /terms launch-time disclaimer page (6 sections) |
| 34 | `028219f` | Per-route OG images for 8 platform routes |
| 36 | `fef37d6` | Route-level loading + error boundaries on all 6 platform surfaces |
| 37 | `7ebfb63` | Mobile responsive sweep (--bp-md/--bp-sm tokens, tap targets, narrow stacking) |

---

## Phase summary

| Phase | Status | Notes |
|-------|--------|-------|
| 1 — Backend hardening | DONE | 7/7 tasks; 79 tests pass |
| 2 — UX completeness | DONE | 7/7 tasks; 109 tests pass |
| 3 — Mainnet code paths | DONE | 5/5; treasury keypair generated, env vars set, branch-bound deploy |
| 4 — House agent on taco | DONE | 7/7; agent_id=`ag_q1ujorfm`, PID 10776, answered test query in 1.44s |
| 5 — E2E fixture rig | DONE | 3/3; final run latency=8.6s, asker→treasury delta confirmed |
| 6 — launch-verify final form | DONE | 11/11 stubs replaced with real checks |
| 7 — Cutover runbook | DONE | 2/2; CUTOVER_RUNBOOK.md at repo root |
| 8 — Final verification | DONE | 3/3; this document |

---

## External state recorded

- **Mainnet treasury pubkey:** `CFgBLpStEPRZf2pHiUbccB731avjvUb7a9yBApu3jR7Y` (keypair: `~/Documents/tradefish-mainnet-treasury.txt`, 0600); funded with 0.04 SOL on mainnet
- **House agent pubkey:** `4eZX2ZdcJCQdN1cMFyHea9LQFwhbzcB8giv5BedVhaXW` (keypair on taco at `/Users/openclaw/tradefish-house-agent/house-agent-keypair.json`, 0600)
- **House agent ID:** `ag_q1ujorfm` (registered + claimed by owner_pubkey `9Yfo2bgH4NZaAJsUiKSWdxUPkxXMrDNM1ophk5HeeDN`); polling staging URL via launchd
- **Fixture-asker pubkey:** `GffX2tdtK2T2mRv2yhpxVjNTgZYMLwHyt18smRZmhUn8`; funded for e2e runs
- **Supabase migrations applied:** 0001-0007 (incl. rate_limits, webhook_secret_encrypted)
- **Vercel Preview env (feat/post-waitlist scope):** all 10 required vars set; secrets backed up locally at `~/Documents/tradefish-*.txt` (0600)
- **Latest preview deploy:** `tradefish-k94t443lc-ggomaengs-projects.vercel.app` (Ready, branch alias points here)

---

## Outstanding (non-blocking)

These were flagged but did not block launch verification:

1. **viewport meta missing in `src/app/layout.tsx`** — file is RUNBOOK §9 don't-touch. Mobile responsive fixes from tick 37 won't engage on real iOS Safari without `<meta name="viewport">`. Recommended add: `export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' }`.
2. **RUNBOOK §6 reconciliation** — RUNBOOK says 1M lamports = 10 credits; route hard-codes 10M lamports = 10 credits. Fixture uses route's actual values. Either update RUNBOOK or relax MIN_LAMPORTS.

---

## Next steps (human-driven)

Per `CUTOVER_RUNBOOK.md` at the repo root, the operator can now execute the 11-step manual cutover to merge `feat/post-waitlist` → `main` and promote to production.

Loop terminates here. No further wakeups scheduled.
