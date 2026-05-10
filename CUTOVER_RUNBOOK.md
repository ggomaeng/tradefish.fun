# CUTOVER_RUNBOOK — promote `feat/post-waitlist` to production

> **Audience:** human operator (you, the owner). Workers do not execute this file.
> **Branch boundary:** the overnight loop never touched `main`. This runbook is the
> hand-off. Read RUNBOOK.md §6 + §9 + §10 before starting.
>
> **Pre-condition before running step 1:** the two outstanding USER ACTIONS in
> `.loop-state/BLOCKED.md` are resolved (house-agent funded; fixture-asker topped up).
> Otherwise step 1 will surface them and you should resolve, not bypass.
>
> **Provenance summary (from STATE.md):**
> - All Phase 1–6 tasks `[x]`. Phase 7 is this file. Phase 8 is post-cutover verify.
> - House agent: `ag_q1ujorfm`, taco wallet `4eZX2ZdcJCQdN1cMFyHea9LQFwhbzcB8giv5BedVhaXW`,
>   registered tick 21, verified responding tick 22 (1.7s e2e), running under launchd
>   PID stable since tick 19 (`com.tradefish.house-agent`).
> - Treasury (mainnet): `CFgBLpStEPRZf2pHiUbccB731avjvUb7a9yBApu3jR7Y` (keypair backup
>   `~/Documents/tradefish-mainnet-treasury.txt`, 0600).
> - Owner wallet: `9Yfo2bgH4NZaAJsUiKSWdxUPkxXMrDNM1ophk5HeeDN`
>   (keypair backup `~/Documents/tradefish-owner-wallet.json`, 0600).
> - Fixture asker: `GffX2tdtK2T2mRv2yhpxVjNTgZYMLwHyt18smRZmhUn8`
>   (keypair `secrets/fixture-asker.json`, 0600).
> - Last green e2e: tick 27, deploy `9f47os5pq`, query `qry_a1oqcmktl5`, latency 6.5s.
> - Staging URL (current): `https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app`

---

## Step 1 — Pre-flight

Confirm everything the loop produced is actually green and on the remote.

```bash
# from tradefish-platform/
npm run launch:verify -- --target=https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app
# expect exit 0 (all 12 checks pass) once funding lands and this file exists
ssh taco "launchctl list | grep tradefish"
# expect: <PID>  0  com.tradefish.house-agent
ssh taco "tail -1 ~/tradefish-house-agent/logs/last_response.json"
# expect a JSON object with a recent ISO timestamp (< 5min old if any traffic)
git fetch origin
git log feat/post-waitlist..origin/feat/post-waitlist --oneline
# expect: empty (everything pushed)
git log origin/feat/post-waitlist..feat/post-waitlist --oneline
# expect: empty (no local commits ahead of remote)
```

**If launch:verify ≠ exit 0:** STOP. Inspect `.loop-state/last-verify.json` for the failing
check name. Resolve the underlying issue (funding gap, dead house agent, etc.) — do
not proceed. The two known failures pre-cutover are `cutover-runbook-present` (this
file fixes) and `e2e-fixture-pass` (needs fixture-asker top-up per BLOCKED.md).

**If house-agent line is missing:** `ssh taco "launchctl load -w ~/Library/LaunchAgents/com.tradefish.house-agent.plist"`.

---

## Step 2 — Backup current production

Create a tag pointing at whatever `main` currently is, so a rollback restores byte-for-byte.

```bash
git checkout main && git pull origin main
git tag prod-before-cutover-$(date +%Y%m%d) main
git push origin --tags
git checkout feat/post-waitlist
# write the current production deploy URL down (Vercel dashboard → Production)
# write the current production env var names down (Vercel dashboard → Settings → Env)
# Vercel → Deployments → Production → "..." → Promote previous deploy is the UI-level rollback
```

**If no `main` exists locally:** `git fetch origin main && git checkout -B main origin/main`.

---

## Step 3 — Apply Supabase migrations to production database

Migrations 0001 → 0007 must be on the prod DB. The loop only pushed 0006 + 0007 to
the linked staging DB (tick 21).

```bash
# from tradefish-platform/
# Confirm which Supabase project is linked:
supabase projects list
# If the linked project is the staging one, switch:
supabase link --project-ref <PROD_REF>          # password from 1Password "TradeFish prod DB"
supabase db push --linked --password "<from 1Password>"
# Verify all 7 migrations are recorded:
supabase db remote commit --dry-run  # OR psql:
psql "<PROD_DSN>" -c "SELECT version FROM supabase_migrations.schema_migrations ORDER BY 1;"
# expect rows: 0001, 0002, 0003, 0004, 0005, 0006, 0007
```

**If push fails on a hand-applied migration:** `supabase migration repair --status applied <version>`
then re-run push. **Never edit a migration file that has been pushed.** If schema drift exists,
resolve in a NEW migration `0008_*.sql` BEFORE the cutover and re-tick the loop.

---

## Step 4 — Set production env vars on Vercel

Mirror the Preview env (set across ticks 13 + 26) onto the **Production** environment
of the same Vercel project. Reuse the SAME secret values — do **not** rotate, or the
house agent's stored `api_key` and HMAC handshakes will break.

Variables to set (Production scope):

| Name                              | Source                                                       |
|-----------------------------------|--------------------------------------------------------------|
| `NEXT_PUBLIC_SOLANA_NETWORK`      | `mainnet-beta`                                               |
| `NEXT_PUBLIC_SOLANA_RPC`          | `https://api.mainnet-beta.solana.com` (or your paid RPC)     |
| `NEXT_PUBLIC_TRADEFISH_TREASURY`  | `CFgBLpStEPRZf2pHiUbccB731avjvUb7a9yBApu3jR7Y`               |
| `WEBHOOK_MASTER_KEY`              | `~/Documents/tradefish-webhook-master-key.txt` (0600)        |
| `SETTLEMENT_CRON_SECRET`          | `~/Documents/tradefish-settlement-cron-secret.txt` (0600)    |
| `CRON_SECRET`                     | identical value to `SETTLEMENT_CRON_SECRET` (Vercel cron uses `CRON_SECRET`; our gate reads `SETTLEMENT_CRON_SECRET`) |
| `INTERNAL_WEBHOOK_HMAC_SECRET`    | `~/Documents/tradefish-internal-webhook-hmac-secret.txt` (0600) |
| `NEXT_PUBLIC_SUPABASE_URL`        | prod Supabase project URL                                    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | prod Supabase anon key                                       |
| `SUPABASE_SERVICE_ROLE_KEY`       | prod Supabase service role key                               |

Procedure (do NOT echo secrets to your terminal history — paste into the Vercel UI
or use `vercel env add … production --sensitive`):

```bash
vercel link                                          # if not linked yet
vercel env ls production                             # see what is already there
# For each missing var:
vercel env add <NAME> production --sensitive          # paste value at prompt
# Confirm names only:
vercel env ls production | grep -E 'NETWORK|RPC|TREASURY|WEBHOOK|SETTLEMENT|CRON|HMAC|SUPABASE'
```

**If a NEXT_PUBLIC_* value is wrong post-deploy:** Next.js bakes them at build time
(see BLOCKED.md tick 26 root cause). You must re-deploy after fixing, not just re-set the env.

---

## Step 5 — Confirm mainnet treasury funded

```bash
solana balance CFgBLpStEPRZf2pHiUbccB731avjvUb7a9yBApu3jR7Y --url mainnet-beta
# expect: ≥ 0.01 SOL (per BLOCKED.md "House agent funding" — same SOL covers tx fees)
```

**If 0:** `solana transfer CFgBLpStEPRZf2pHiUbccB731avjvUb7a9yBApu3jR7Y 0.01 --from ~/Documents/tradefish-owner-wallet.json --url mainnet-beta --allow-unfunded-recipient`.

**Also confirm house-agent wallet is funded** (BLOCKED.md item, discovered tick 17):

```bash
solana balance 4eZX2ZdcJCQdN1cMFyHea9LQFwhbzcB8giv5BedVhaXW --url mainnet-beta
# expect: ≥ 0.01 SOL
```

---

## Step 6 — Open the merge PR

```bash
gh pr create \
  --base main \
  --head feat/post-waitlist \
  --title "TradeFish post-waitlist platform: Phases 1–6 (overnight loop)" \
  --body "$(cat <<'EOF'
## Summary
Promotes the platform code (post-waitlist) to production. Built end-to-end across
29 ticks of the overnight launch loop on `feat/post-waitlist`.

## What landed
- **Phase 1 — backend hardening:** rate limits (Supabase table, RUNBOOK §3), AES-GCM
  webhook secrets at rest (RUNBOOK §4), HMAC dispatch signatures, settlement cron
  bearer auth, structured error envelopes across 12 routes, idempotent respond path.
  79 tests → 107 tests.
- **Phase 3 — mainnet code paths:** `lib/solana-config.ts` per-network switch,
  Pyth mainnet feed IDs verified live, mainnet treasury keypair generated
  (`CFgBLpStEPRZf2pHiUbccB731avjvUb7a9yBApu3jR7Y`).
- **Phase 4 — house agent on `taco`:** heuristic-momentum agent (RUNBOOK §5),
  registered as `ag_q1ujorfm`, running under launchd, last verified responding 1.7s e2e.
- **Phase 5 — e2e fixture rig:** `npm run e2e:fixture` exits 0 against staging
  with mainnet config (latency 6.5s).
- **Phase 6 — launch-verify:** all 11 stubs replaced with real checks. Last run:
  10 pass / 2 fail (the 2 fails are this PR + fixture-asker re-funding).
- **Phase 7 — this runbook.**

## Verification
- `npm run launch:verify` — see `.loop-state/last-verify.json`.
- `npm run e2e:fixture` — see `.loop-state/last-e2e-fixture.json` (exit 0, tick 27).
- House agent on taco: `ssh taco "launchctl list | grep tradefish"`.

## Outstanding USER ACTIONS (resolve before merging)
See `.loop-state/BLOCKED.md`:
- Fixture-asker top-up (≥ 0.02 SOL → `GffX2tdtK2T2mRv2yhpxVjNTgZYMLwHyt18smRZmhUn8`).
- House-agent funding (≥ 0.01 SOL → `4eZX2ZdcJCQdN1cMFyHea9LQFwhbzcB8giv5BedVhaXW`).

## Don't-touch list (RUNBOOK §9) — VERIFY UNCHANGED IN DIFF
The waitlist + landing surfaces MUST be byte-identical:
- `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/opengraph-image.tsx`
- `src/app/api/waitlist/route.ts`, `src/components/WaitlistForm.tsx`
- `src/components/HeroSwarm.tsx`, `src/components/LightRays.tsx`
- `supabase/migrations/0002_waitlist.sql`
- `public/logo.png`, `public/fonts/DepartureMono-Regular.woff2`
- `src/app/DepartureMono-Regular.otf`, `src/app/logo-og.png`

Reviewer command: `git diff --name-only main...feat/post-waitlist | grep -Ff <(awk -F'`' '/^- `/ {print $2}' <RUNBOOK.md §9 lines>)` — should print nothing.

## Rollback plan
`git revert <merge_sha> && git push origin main`. Vercel auto-deploys the revert.
House agent on taco continues polling its current BASE_URL (no impact). Tag
`prod-before-cutover-YYYYMMDD` is the byte-exact prior state if a hard reset is needed.
EOF
)"
```

**If `gh` not authenticated:** `gh auth login --git-protocol https --web`.

---

## Step 7 — Reviewer checklist (you, before clicking merge)

Walk this list line-by-line in the GitHub diff view. **Any "no" → block the merge.**

- [ ] None of the 12 don't-touch files (RUNBOOK §9) appear in the diff.
- [ ] No `.env`, `.env.local`, `.env.preview`, `.env.production` files in the diff.
- [ ] No `*.json` keypair files (search the diff for `"secretKey"`, `"_keypair"`, base58 strings).
- [ ] `vercel.json` cron config still references `/api/settle` and Vercel-style auth (no inline secret).
- [ ] `src/content/skill.md` matches current API route shapes (Phase 4 worker updated this; eyeball-confirm).
- [ ] `npm test` is green locally on `feat/post-waitlist` HEAD (107+ tests).
- [ ] No new dependencies you didn't expect (`git diff main...feat/post-waitlist -- package.json`).
- [ ] Production DB has no test/fixture rows (`SELECT count(*) FROM agents WHERE owner_pubkey IS NULL OR owner_handle LIKE '%fixture%';` → 0).
- [ ] `/api/settle` requires bearer auth in the diff (search for `SETTLEMENT_CRON_SECRET`).
- [ ] Migration order 0001 → 0007 unbroken; no renumbering.
- [ ] `.loop-state/` directory not pushed (it's an artifact of the loop; OK to keep, but confirm no secrets in `last-verify.json` or similar).

---

## Step 8 — Merge

```bash
gh pr merge --squash --delete-branch=false <PR_NUMBER>
# --delete-branch=false keeps feat/post-waitlist around for ~7 days as forensic backup
```

Vercel will auto-detect the push to `main` and start a Production build. **Watch it
to completion** in the Vercel dashboard — do NOT proceed until the build is green
and the new deploy is promoted to the production alias.

**If build fails:** read the build log. Common cause is a missing Production env var
(step 4). Fix env, then `vercel --prod` to re-deploy from the same commit.

**If build succeeds but deploy is unhealthy:** rollback per the bottom of this file.

---

## Step 9 — Post-deploy smoke test

```bash
PROD=https://<your-production-domain>
curl -s -o /dev/null -w "%{http_code} %{url}\n" "$PROD/"                    # expect 200
curl -s -o /dev/null -w "%{http_code} %{url}\n" "$PROD/arena"               # expect 200
curl -s -o /dev/null -w "%{http_code} %{url}\n" "$PROD/skill.md"            # expect 200
curl -s -o /dev/null -w "%{http_code} %{url}\n" "$PROD/api/settle"          # expect 401
curl -s -X POST -H "Content-Type: application/json" -d '{}' \
     -o /dev/null -w "%{http_code} %{url}\n" "$PROD/api/credits/topup"      # expect 400

# Per RUNBOOK §9 — homepage MUST still render the waitlist component:
curl -s "$PROD/" | grep -E 'WaitlistForm|waitlist|email' >/dev/null && echo "WAITLIST OK" || echo "WAITLIST MISSING — STOP"
```

**If WAITLIST MISSING:** rollback immediately (see bottom). Production must continue
to honor the waitlist surface that was live before this merge.

**If `/api/settle` returns ≠ 401:** the bearer auth env var didn't load. Re-check step 4.

---

## Step 10 — Re-point the house agent on `taco` to production

The house agent on `taco` is currently polling the staging URL
(`https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app`).
Re-point it at production. **Reuse the same `HOUSE_AGENT_API_KEY`** — the agent row
(`ag_q1ujorfm`, owner `9Yfo2bgH4NZaAJsUiKSWdxUPkxXMrDNM1ophk5HeeDN`) lives in the
production DB after step 3 + step 8.

```bash
ssh taco
PLIST=~/Library/LaunchAgents/com.tradefish.house-agent.plist
# Inspect current config first:
plutil -p "$PLIST" | grep -E 'BASE_URL|TRADEFISH_BASE|HOUSE_AGENT_API_KEY' | sed 's/=> ".*"/=> "<redacted>"/'
# Edit BASE_URL (key is whatever the worker named it in tick 19 — likely TRADEFISH_BASE_URL or BASE_URL):
plutil -replace 'EnvironmentVariables.TRADEFISH_BASE_URL' -string 'https://<your-production-domain>' "$PLIST"
# OR open in $EDITOR if you prefer XML editing.
launchctl unload "$PLIST"
launchctl load -w "$PLIST"
launchctl list | grep tradefish      # expect <PID>  0  com.tradefish.house-agent
tail -f ~/tradefish-house-agent/logs/stdout.log    # watch one full poll cycle (~10s)
# expect: 200 responses, no auth errors. Ctrl-C when satisfied.
```

**If the agent 401s after re-point:** the production DB is missing the agent row.
Either Step 3 didn't promote the row, or the api_key is stored differently in prod.
Re-register the agent against production via `/skill.md` and re-claim with the owner
wallet (see STATE.md tick 21 for the procedure). Save the new api_key into the plist.

**If the key name is not `TRADEFISH_BASE_URL`:** look in
`~/tradefish-house-agent/index.js` (or whatever the entry point is) for `process.env.*`
that contains the URL — that's the env var to set.

---

## Step 11 — Final acceptance test against production

```bash
# from tradefish-platform/, on feat/post-waitlist (or main, equivalent code)
PROD=https://<your-production-domain>
# Make sure the fixture-asker has at least 0.02 SOL (BLOCKED.md):
solana balance GffX2tdtK2T2mRv2yhpxVjNTgZYMLwHyt18smRZmhUn8 --url mainnet-beta
# Run the e2e fixture against production:
npm run e2e:fixture -- --target="$PROD"
# expect: outcome=ok, exit_code=0, latency < 30000ms
cat .loop-state/last-e2e-fixture.json | jq '.outcome,.exit_code,.latency_ms,.house_agent_responded'
# expect: "ok", 0, <number>, true
```

**If outcome ≠ ok:** capture `.loop-state/last-e2e-fixture.json` and re-tick the loop
(or rollback). Production is **not** considered live until this test is green.

**Optional cleanup once production is stable for ≥ 24h:**

```bash
vercel alias rm tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app
# (keeps the deploy itself; just unbinds the staging branch alias)
```

---

## Rollback plan

If anything breaks after step 8 — revert the merge commit. Vercel will auto-deploy
the prior `main` and the waitlist surface returns identical to what it was before.

```bash
git checkout main && git pull origin main
git log --oneline -5                          # find <merge_sha>
git revert <merge_sha>                        # creates a new commit; do NOT --no-commit
git push origin main
# Vercel auto-deploys the revert.
# Watch the Production deploy in Vercel dashboard until green.
# House agent on taco: no action needed — keeps polling whatever URL it was last set to.
#   If you already did step 10, re-point it back to staging:
#   ssh taco "plutil -replace 'EnvironmentVariables.TRADEFISH_BASE_URL' -string 'https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app' ~/Library/LaunchAgents/com.tradefish.house-agent.plist && launchctl unload ~/Library/LaunchAgents/com.tradefish.house-agent.plist && launchctl load -w ~/Library/LaunchAgents/com.tradefish.house-agent.plist"
```

**Hard reset (only if revert fails):** `git reset --hard prod-before-cutover-YYYYMMDD && git push --force-with-lease origin main`. **Never `--force` without `--with-lease`.** Tell the team in #ops first.

**What does NOT need rollback on revert:**
- Supabase migrations 0001–0007 — they are additive; tables stay; old code ignores new columns.
- Vercel env vars — they sit unused until the next promotion.
- House agent on taco — keeps running.

**What might need cleanup after a rollback:**
- Any production rows created during the brief live window — inspect `agents`, `queries`, `responses`, `topups` for `created_at > <merge_time>`.
- Drop any `agents` row whose `owner_pubkey` is unknown (was a real user signup) — coordinate with the owner before deleting.
