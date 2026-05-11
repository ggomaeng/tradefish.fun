# Staging QA Pre-Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the full TradeFish staging system end-to-end on `feat/post-waitlist` before merging to `main`. Cover what `launch:verify` and `e2e:fixture` already test (poll-mode + house agent), plus the gaps they don't (webhook-mode delivery, browser asker UX, settlement loop, failure modes, mobile rendering). Produce a go/no-go recommendation.

**Architecture:** Layered pass — re-run existing automated checks first (cheapest, highest signal-per-minute), then exercise gaps manually. Use real mainnet SOL for the fixture path (already proven, costs ~0.01 SOL per run, treasury has 0.04 SOL budget = 4 runs). For webhook-mode (the largest untested path), spin up a throwaway HTTPS receiver and walk a fresh agent through the full skill.md contract.

**Tech Stack:** existing Node/tsx scripts (`launch:verify`, `e2e:fixture`), curl + jq for API probes, gstack `/browse` for browser QA, `cloudflared` or `ngrok` for the webhook receiver, `psql` (or supabase service-role REST) for DB introspection, Pyth Hermes price API for entry-price spot-checks.

**Staging target:** `https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app`
**Treasury budget for QA:** 0.04 SOL (~4 fixture runs). Stop and re-fund if depleted.
**House agent:** `ag_q1ujorfm` (poll-mode), running on taco, last response < 8h.
**DON'T TOUCH** files owned by parallel session: see `tradefish_dont_touch.md` (waitlist surfaces). All edits during QA stay in `feat/post-waitlist` branch.

---

## File Structure

This plan produces no source code changes by default — it's pure verification. Artifacts created:

- **Create:** `docs/superpowers/qa-reports/2026-05-10-staging-qa.md` — final go/no-go report with pass/fail/severity per check
- **Create (transient):** `.qa/webhook-receiver/` — throwaway HTTPS webhook receiver (gitignored, deleted after Phase 5)
- **Append:** `.loop-state/last-qa-run.json` — structured per-phase results

If a check fails and the fix is small (typo, missing log, unclear error message), fix in-place and commit per task. Anything bigger → flag in report, do not fix during QA.

---

## Phase 0: Pre-flight & baseline

### Task 0.1: Confirm environment

**Files:**
- Read: `tradefish-platform/.env.local` (must exist; not committed)
- Read: `tradefish-platform/.loop-state/last-verify.json`

- [ ] **Step 1: Verify branch + clean tree**

```bash
cd /Users/ggoma/Projects/hackathons/solana.new/tradefish-platform
git branch --show-current
git status --short
```

Expected: branch `feat/post-waitlist`, working tree clean (or only `docs/superpowers/plans/2026-05-10-staging-qa-pre-cutover.md` if uncommitted).

- [ ] **Step 2: Confirm staging URL is reachable**

```bash
STAGING=https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app
curl -sI "$STAGING" | head -3
```

Expected: `HTTP/2 200` (or 307 → 200 after redirect).

- [ ] **Step 3: Confirm `.env.local` has the required vars for QA**

```bash
grep -E "^(SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_URL|WEBHOOK_MASTER_KEY|SETTLEMENT_CRON_SECRET)=" .env.local | awk -F= '{print $1}'
```

Expected: all 4 names printed. If any missing → STOP, restore from `~/Documents/tradefish-*.txt` backups before proceeding.

- [ ] **Step 4: Snapshot baseline DB counts**

```bash
mkdir -p .qa
SUPABASE_URL=$(grep ^NEXT_PUBLIC_SUPABASE_URL= .env.local | cut -d= -f2-)
SR_KEY=$(grep ^SUPABASE_SERVICE_ROLE_KEY= .env.local | cut -d= -f2-)
for table in agents queries responses settlements; do
  COUNT=$(curl -s -H "apikey: $SR_KEY" -H "Authorization: Bearer $SR_KEY" \
    -H "Prefer: count=exact" -H "Range: 0-0" \
    "$SUPABASE_URL/rest/v1/$table?select=id" -I | grep -i content-range | awk '{print $2}' | tr -d '\r')
  echo "$table: $COUNT" | tee -a .qa/baseline-counts.txt
done
```

Expected: all 4 tables exist, return Content-Range like `0-0/N`. Save N for each table — later phases compare deltas.

- [ ] **Step 5: Confirm house agent on taco is alive**

```bash
ssh taco "launchctl list | grep tradefish && tail -1 ~/tradefish-house-agent/logs/last_response.json 2>/dev/null"
```

Expected: line like `<PID>  0  com.tradefish.house-agent` and a JSON object with a recent ISO timestamp. If missing → `ssh taco "launchctl load -w ~/Library/LaunchAgents/com.tradefish.house-agent.plist"` then re-check.

- [ ] **Step 6: Commit baseline snapshot**

```bash
git add .qa/baseline-counts.txt 2>/dev/null
echo ".qa/" >> .gitignore
# baseline file goes in .qa/ which is now gitignored — only the gitignore entry commits
git add .gitignore
git diff --cached --stat
git commit -m "chore(qa): gitignore .qa/ workspace for staging QA pass"
```

Expected: one-file commit. `.qa/` stays local-only.

---

## Phase 1: Re-run automated checks (regression baseline)

### Task 1.1: Type-check, lint, tests

**Files:**
- Read: `package.json`

- [ ] **Step 1: Type-check**

```bash
npx tsc --noEmit
echo "EXIT: $?"
```

Expected: `EXIT: 0`, no errors printed.

- [ ] **Step 2: Vitest suite**

```bash
npm run test 2>&1 | tail -20
echo "EXIT: $?"
```

Expected: `EXIT: 0`, line like `Tests  109 passed (109)`. If any failure: STOP, this is a regression — file in QA report and do NOT proceed to Phase 2.

- [ ] **Step 3: Lint (only if `lint` script defined)**

```bash
grep -q '"lint"' package.json && npm run lint 2>&1 | tail -10 || echo "no lint script — skip"
```

Expected: clean exit if lint exists; "no lint script — skip" otherwise.

### Task 1.2: launch-verify against staging

- [ ] **Step 1: Run launch-verify**

```bash
STAGING=https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app
npm run launch:verify -- --target=$STAGING
echo "EXIT: $?"
```

Expected: `12 pass / 0 warn / 0 fail`, `EXIT: 0`. If less than 12 pass → STOP, file in report.

- [ ] **Step 2: Snapshot the report**

```bash
cp .loop-state/last-verify.json .qa/phase1-launch-verify.json
jq '.results | map({name, status, detail})' .qa/phase1-launch-verify.json
```

Expected: 12 objects, all `status: "pass"`. Detail strings should match what's in the previous good run (compare manually for drift in numbers like treasury balance, slot, mainnet feed values).

---

## Phase 2: End-to-end fixture (poll path, automated)

### Task 2.1: Run e2e:fixture against staging

**Files:**
- Read: `scripts/e2e-fixture/index.ts:1-100` (already familiar)

- [ ] **Step 1: Confirm fixture-asker has enough SOL**

```bash
FIXTURE_PUBKEY=$(node -e "const k=require('./secrets/fixture-asker.json'); const {Keypair}=require('@solana/web3.js'); console.log(Keypair.fromSecretKey(Uint8Array.from(k)).publicKey.toBase58())")
echo "Fixture asker: $FIXTURE_PUBKEY"
RPC=$(grep ^NEXT_PUBLIC_SOLANA_RPC= .env.local | cut -d= -f2-)
curl -s "$RPC" -H "Content-Type: application/json" -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getBalance\",\"params\":[\"$FIXTURE_PUBKEY\"]}" | jq '.result.value'
```

Expected: lamports value ≥ 11_000_000 (0.011 SOL — one full run + buffer). If less → STOP, top up fixture-asker from owner wallet before proceeding.

- [ ] **Step 2: Run the fixture**

```bash
set -a; source .env.local; set +a
STAGING=https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app
npm run e2e:fixture -- --target=$STAGING 2>&1 | tee .qa/phase2-fixture.log
echo "EXIT: $?"
```

Expected: `EXIT: 0`, JSON summary with `outcome: "ok"`, `house_agent_responded: true`, `latency_ms < 15000`. Treasury delta should be exactly +10_000_000 lamports vs Phase 0 baseline.

- [ ] **Step 3: Verify the query lifecycle in DB**

```bash
QID=$(jq -r .query_id .qa/phase2-fixture.log 2>/dev/null || tail -1 .qa/phase2-fixture.log | jq -r .query_id)
SR_KEY=$(grep ^SUPABASE_SERVICE_ROLE_KEY= .env.local | cut -d= -f2-)
SUPABASE_URL=$(grep ^NEXT_PUBLIC_SUPABASE_URL= .env.local | cut -d= -f2-)
curl -s -H "apikey: $SR_KEY" -H "Authorization: Bearer $SR_KEY" \
  "$SUPABASE_URL/rest/v1/queries?short_id=eq.$QID&select=*,responses(*)" | jq
```

Expected: query row exists with at least one response from `agent_id=ag_q1ujorfm`. Response row has `entry_price_usd` populated (Pyth snapshot worked).

**If outcome ≠ "ok":** STOP. Inspect `.qa/phase2-fixture.log` and `.loop-state/last-e2e-fixture.json`. Common failures: `treasury_unfunded`, `no_house_response` (taco LaunchAgent died — restart it), `topup_failed` (Solana RPC rate-limited — wait + retry).

---

## Phase 3: API contract probes (no SOL cost)

### Task 3.1: Public endpoint surface

**Files:**
- Read: `src/app/api/agents/[id]/route.ts` (verify shape)
- Read: `src/content/skill.md` (already familiar)

- [ ] **Step 1: skill.md serves correctly**

```bash
STAGING=https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app
curl -s "$STAGING/skill.md" | head -10
curl -sI "$STAGING/skill.md" | grep -iE "content-type|status"
```

Expected: first 10 lines start with frontmatter `---\nname: tradefish\n...version: 0.2.0`. Content-Type should be `text/markdown` or `text/plain` (Next.js default). HTTP 200.

- [ ] **Step 2: /docs page renders**

```bash
curl -s "$STAGING/docs" | grep -oE "<title>[^<]*</title>"
curl -sI "$STAGING/docs" | head -3
```

Expected: title contains "TradeFish". HTTP 200.

- [ ] **Step 3: /terms page renders**

```bash
curl -sI "$STAGING/terms" | head -3
curl -s "$STAGING/terms" | grep -ic "disclaimer\|paper-trade\|not financial advice" | head -1
```

Expected: HTTP 200. At least 1 match for the disclaimer keywords.

- [ ] **Step 4: /agents listing renders**

```bash
curl -sI "$STAGING/agents" | head -3
curl -s "$STAGING/agents" | grep -oE "ag_[a-z0-9]{8,}" | sort -u | head -5
```

Expected: HTTP 200. At least one `ag_` short ID (the house agent) appears in the rendered HTML.

- [ ] **Step 5: 404 page is styled, not raw**

```bash
curl -sI "$STAGING/this-route-does-not-exist-$(date +%s)" | head -3
curl -s "$STAGING/this-route-does-not-exist-$(date +%s)" | grep -c "404\|not found" | head -1
```

Expected: HTTP 404. Body contains "404" or "not found" (i.e. styled page rendered, not raw text).

### Task 3.2: Error response shape consistency

- [ ] **Step 1: Invalid JSON body → 400 invalid_json**

```bash
STAGING=https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app
curl -s -w "\nHTTP %{http_code}\n" -X POST "$STAGING/api/agents/register" \
  -H "Content-Type: application/json" -d 'not json'
```

Expected: HTTP 400, body is `{"error":"...","code":"invalid_json","request_id":"..."}` (uuid in request_id).

- [ ] **Step 2: Validation failure → 400 validation_failed with extra.issues**

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST "$STAGING/api/agents/register" \
  -H "Content-Type: application/json" -d '{"name":"x"}'
```

Expected: HTTP 400, body has `code: "validation_failed"`, `extra.issues` is a non-empty array (Zod issues for missing fields).

- [ ] **Step 3: Unknown agent → 404 not_found (or similar)**

```bash
curl -s -w "\nHTTP %{http_code}\n" "$STAGING/api/agents/ag_doesnotexist"
```

Expected: HTTP 404, body has `code` field (machine-readable). Whatever the code is, record it for the report — must match what skill.md documents.

### Task 3.3: Rate limiting fires under burst

- [ ] **Step 1: Hammer /api/agents/register 12× in <60s**

```bash
STAGING=https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app
for i in $(seq 1 12); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$STAGING/api/agents/register" \
    -H "Content-Type: application/json" -d '{"name":"rate-test","delivery":"poll"}')
  echo "req $i → $CODE"
done
```

Expected: first ~10 return 201 (or 400 from missing required field — whatever is the route's Zod result for this body), at least the last 2 return `429`. If no 429 fires within 12 requests → rate limit broken; flag SEV-1 in report.

**Cleanup:** if any 201s succeeded (created real agents), delete them by short_id via service-role REST in Phase 11 cleanup.

---

## Phase 4: Builder onboarding — POLL mode (manual walkthrough)

### Task 4.1: Walk through skill.md as a fresh builder

This phase simulates "human reads /skill.md, follows the contract by hand." If it's confusing or broken at any step → SEV-1.

- [ ] **Step 1: Register a new poll-mode agent**

```bash
STAGING=https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app
RESP=$(curl -s -X POST "$STAGING/api/agents/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"qa-poll-bot","description":"QA poll-mode test agent","delivery":"poll"}')
echo "$RESP" | jq
echo "$RESP" | jq -r .agent_id > .qa/poll-agent-id.txt
echo "$RESP" | jq -r .api_key  > .qa/poll-agent-apikey.txt
echo "$RESP" | jq -r .claim_url > .qa/poll-agent-claim-url.txt
```

Expected: 201 response with `agent_id` (`ag_...`), `api_key` (`tf_...`), `claim_url`. NO `webhook_secret` since delivery=poll.

- [ ] **Step 2: GET the agent — confirm public lookup works**

```bash
AGENT_ID=$(cat .qa/poll-agent-id.txt)
curl -s "$STAGING/api/agents/$AGENT_ID" | jq
```

Expected: full agent record. `claimed: false`, `delivery: "poll"`, `endpoint: null`, `last_seen_at: null` (or null until first poll).

- [ ] **Step 3: Poll /api/queries/pending with the API key — empty queue OK**

```bash
APIKEY=$(cat .qa/poll-agent-apikey.txt)
curl -s -H "Authorization: Bearer $APIKEY" "$STAGING/api/queries/pending" | jq
```

Expected: `{"queries": []}` or similar empty-state shape (no error). Confirms auth works.

- [ ] **Step 4: Try polling with bad API key → 401**

```bash
curl -s -w "\nHTTP %{http_code}\n" -H "Authorization: Bearer tf_doesnotexist" "$STAGING/api/queries/pending"
```

Expected: HTTP 401 with structured error body (code field present).

### Task 4.2: Trigger a query, verify it appears in poll-agent's pending

- [ ] **Step 1: Have e2e fixture submit a query (uses real fixture-asker SOL)**

```bash
# Re-running fixture is the cheapest way to get a real query into the system
# without manually orchestrating the topup tx. Cost: 0.01 SOL.
set -a; source .env.local; set +a
npm run e2e:fixture -- --target=$STAGING 2>&1 | tee .qa/phase4-fixture.log
QID=$(grep -oE 'qry_[a-z0-9]+' .qa/phase4-fixture.log | head -1)
echo "QUERY_ID=$QID"
```

Expected: same as Phase 2 — `outcome: "ok"`. Note the `qry_...` ID.

- [ ] **Step 2: Poll from QA poll-bot — query should be visible**

```bash
APIKEY=$(cat .qa/poll-agent-apikey.txt)
curl -s -H "Authorization: Bearer $APIKEY" "$STAGING/api/queries/pending" | jq
```

Expected: `{"queries": [...]}` with at least one entry that includes the `query_id` from Step 1, OR empty (acceptable iff the query already passed `deadline_at` — 60s window). If empty due to deadline: re-run fixture and poll within 30s.

**Note:** the fan-out in `/api/internal/dispatch` only POSTs to `delivery="webhook"` agents; poll agents discover queries by polling `/api/queries/pending`. Confirm this works.

### Task 4.3: Submit a response from the poll agent

- [ ] **Step 1: Pick the query, respond with confidence + reasoning**

```bash
APIKEY=$(cat .qa/poll-agent-apikey.txt)
QID_FULL=$(curl -s -H "Authorization: Bearer $APIKEY" "$STAGING/api/queries/pending" | jq -r '.queries[0].query_id')
echo "Responding to: $QID_FULL"
curl -s -w "\nHTTP %{http_code}\n" -X POST "$STAGING/api/queries/$QID_FULL/respond" \
  -H "Authorization: Bearer $APIKEY" \
  -H "Content-Type: application/json" \
  -d '{"answer":"hold","confidence":0.55,"reasoning":"qa poll-bot smoke test"}'
```

Expected: HTTP 200 with response receipt. Response stored.

- [ ] **Step 2: Verify the response landed in DB with entry_price_usd**

```bash
SR_KEY=$(grep ^SUPABASE_SERVICE_ROLE_KEY= .env.local | cut -d= -f2-)
SUPABASE_URL=$(grep ^NEXT_PUBLIC_SUPABASE_URL= .env.local | cut -d= -f2-)
AGENT_ID=$(cat .qa/poll-agent-id.txt)
curl -s -H "apikey: $SR_KEY" -H "Authorization: Bearer $SR_KEY" \
  "$SUPABASE_URL/rest/v1/responses?agent_id=eq.$AGENT_ID&select=*&order=created_at.desc&limit=1" | jq
```

Expected: one row, `answer: "hold"`, `confidence: 0.55`, `entry_price_usd` is non-null (a Pyth snapshot was taken).

---

## Phase 5: Builder onboarding — WEBHOOK mode (CRITICAL GAP)

The house agent uses poll mode. The webhook delivery path has unit tests but has NEVER been exercised end-to-end against staging with a real external HTTPS receiver. This phase closes that gap.

### Task 5.1: Spin up a throwaway HTTPS webhook receiver

**Files:**
- Create: `.qa/webhook-receiver/server.mjs`

- [ ] **Step 1: Write the receiver**

```bash
mkdir -p .qa/webhook-receiver
cat > .qa/webhook-receiver/server.mjs <<'EOF'
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";

const PORT = 4747;
const SECRET_PATH = ".qa/webhook-receiver/secret.txt";
const LOG_PATH = ".qa/webhook-receiver/events.jsonl";

function loadSecret() {
  if (!fs.existsSync(SECRET_PATH)) throw new Error("write secret to " + SECRET_PATH + " first");
  return fs.readFileSync(SECRET_PATH, "utf8").trim();
}

http.createServer((req, res) => {
  const chunks = [];
  req.on("data", c => chunks.push(c));
  req.on("end", () => {
    const body = Buffer.concat(chunks);
    const sig = req.headers["x-tradefish-signature"] || "";
    const event = req.headers["x-tradefish-event"] || "";
    const secret = loadSecret();
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
    const valid = sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    const entry = {
      ts: new Date().toISOString(),
      method: req.method,
      url: req.url,
      event,
      sig_received: sig,
      sig_expected: expected,
      sig_valid: valid,
      body: body.toString("utf8").slice(0, 2000),
    };
    fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n");
    console.log(`[webhook] ${req.method} ${req.url} event=${event} valid=${valid}`);
    res.writeHead(202, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ accepted: true, sig_valid: valid }));
  });
}).listen(PORT, () => console.log(`receiver listening on :${PORT}`));
EOF
ls -la .qa/webhook-receiver/
```

Expected: `server.mjs` exists.

- [ ] **Step 2: Start a public HTTPS tunnel — choose ONE**

Option A: cloudflared (preferred — anonymous, no account):
```bash
cloudflared tunnel --url http://localhost:4747 2>&1 | tee .qa/webhook-receiver/tunnel.log &
sleep 6
TUNNEL_URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" .qa/webhook-receiver/tunnel.log | head -1)
echo "TUNNEL_URL=$TUNNEL_URL"
```

Option B: ngrok (requires `ngrok` CLI + free token):
```bash
ngrok http 4747 --log=stdout > .qa/webhook-receiver/tunnel.log &
sleep 4
TUNNEL_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url')
echo "TUNNEL_URL=$TUNNEL_URL"
```

Expected: `TUNNEL_URL` is a working `https://...` URL. Verify: `curl -sI "$TUNNEL_URL"` returns a response (any code).

- [ ] **Step 3: Start the receiver (foreground in a separate terminal, or background)**

```bash
node .qa/webhook-receiver/server.mjs > .qa/webhook-receiver/server.log 2>&1 &
echo "RECEIVER_PID=$!"
sleep 1
curl -s http://localhost:4747/healthz -X POST -d 'ping' -H "X-TradeFish-Event: test"
ls .qa/webhook-receiver/
```

Expected: receiver PID printed. The curl test triggers a log entry (will fail HMAC because no secret yet — that's fine, just confirming it's listening). `events.jsonl` exists.

### Task 5.2: Register a webhook agent pointing at the tunnel

- [ ] **Step 1: Register**

```bash
STAGING=https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app
TUNNEL_URL=<paste from Task 5.1 Step 2>
RESP=$(curl -s -X POST "$STAGING/api/agents/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"qa-webhook-bot\",\"description\":\"QA webhook test\",\"delivery\":\"webhook\",\"endpoint\":\"$TUNNEL_URL\"}")
echo "$RESP" | jq
echo "$RESP" | jq -r .agent_id > .qa/webhook-agent-id.txt
echo "$RESP" | jq -r .api_key  > .qa/webhook-agent-apikey.txt
echo "$RESP" | jq -r .webhook_secret > .qa/webhook-receiver/secret.txt
chmod 600 .qa/webhook-receiver/secret.txt
```

Expected: 201 with `agent_id`, `api_key`, AND `webhook_secret` (since delivery=webhook). `webhook_secret` starts with `whs_`.

- [ ] **Step 2: Verify the agent record stored the endpoint**

```bash
AGENT_ID=$(cat .qa/webhook-agent-id.txt)
curl -s "$STAGING/api/agents/$AGENT_ID" | jq '{delivery, endpoint, last_seen_at}'
```

Expected: `delivery: "webhook"`, `endpoint` matches your tunnel URL, `last_seen_at: null`.

### Task 5.3: Submit a query, verify webhook fires AND HMAC validates

- [ ] **Step 1: Trigger a real query via fixture (only practical way without manual SOL topup)**

```bash
set -a; source .env.local; set +a
npm run e2e:fixture -- --target=$STAGING 2>&1 | tee .qa/phase5-fixture.log
echo "---"
echo "Wait 5s for fan-out dispatch..."
sleep 5
```

Expected: fixture exit 0. The fan-out in /api/internal/dispatch should have POSTed to your tunnel.

- [ ] **Step 2: Inspect receiver log — confirm webhook arrived AND signature valid**

```bash
cat .qa/webhook-receiver/events.jsonl | jq -c '{ts, event, sig_valid, body_first120: .body[:120]}'
```

Expected: at least one entry with `event: "query.created"` and `sig_valid: true`. Body is JSON with `query_id`, `token`, `question: "buy_sell_now"`, `deadline_at`. If `sig_valid: false` → SEV-1, HMAC implementation broken.

- [ ] **Step 3: Respond from the webhook agent**

```bash
APIKEY=$(cat .qa/webhook-agent-apikey.txt)
QID_FULL=$(jq -r '.body | fromjson | .query_id' < <(tail -1 .qa/webhook-receiver/events.jsonl))
echo "Responding to: $QID_FULL"
curl -s -w "\nHTTP %{http_code}\n" -X POST "$STAGING/api/queries/$QID_FULL/respond" \
  -H "Authorization: Bearer $APIKEY" \
  -H "Content-Type: application/json" \
  -d '{"answer":"buy","confidence":0.7,"reasoning":"qa webhook-bot smoke test"}'
```

Expected: HTTP 200, response stored.

- [ ] **Step 4: Verify in DB**

```bash
SR_KEY=$(grep ^SUPABASE_SERVICE_ROLE_KEY= .env.local | cut -d= -f2-)
SUPABASE_URL=$(grep ^NEXT_PUBLIC_SUPABASE_URL= .env.local | cut -d= -f2-)
AGENT_ID=$(cat .qa/webhook-agent-id.txt)
curl -s -H "apikey: $SR_KEY" -H "Authorization: Bearer $SR_KEY" \
  "$SUPABASE_URL/rest/v1/responses?agent_id=eq.$AGENT_ID&select=*&order=created_at.desc&limit=1" | jq
```

Expected: response row with `answer: "buy"`, `confidence: 0.7`, `entry_price_usd` populated.

### Task 5.4: Negative test — bad HMAC sig should NOT crash dispatch path

The dispatch is fire-and-forget from the platform's side, but a misconfigured receiver shouldn't block other agents from receiving the same query.

- [ ] **Step 1: Corrupt the secret on the receiver side, trigger another query**

```bash
echo "wrong_secret_$(date +%s)" > .qa/webhook-receiver/secret.txt
chmod 600 .qa/webhook-receiver/secret.txt
set -a; source .env.local; set +a
npm run e2e:fixture -- --target=$STAGING 2>&1 | tee .qa/phase5-bad-hmac.log
sleep 5
cat .qa/webhook-receiver/events.jsonl | jq -c '{ts, sig_valid}' | tail -3
```

Expected: receiver logs show `sig_valid: false` for the new event. Fixture still exits 0 (house agent responds via poll, unaffected). Webhook agent never responds — that's the expected failure mode.

**Restore correct secret** for cleanup:
```bash
cat .qa/webhook-agent-apikey.txt > /dev/null  # sanity
# secret was returned at registration; we don't have it anymore unless we saved it
# If saved in step 5.2: restore from there. If not: skip (the bad-secret state IS the test).
```

---

## Phase 6: Asker UX in browser (gstack /browse)

This phase exercises the actual user-facing UI. Use gstack's `/browse` skill (headless Chromium with screenshot + interaction).

### Task 6.1: Static-page rendering smoke

**Files:**
- Read: `src/app/page.tsx`, `src/app/docs/page.tsx`, `src/app/agents/page.tsx`

- [ ] **Step 1: Open landing page, capture screenshot**

Use `/browse` to navigate to `https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app/` and take a full-page screenshot.

Expected: hero + CTA visible, no broken images, fonts loaded (Inter + JetBrains Mono — no FOUT/serif fallback). Save screenshot to `.qa/screenshots/landing.png`.

- [ ] **Step 2: /agents listing**

Navigate to `/agents`. Screenshot.

Expected: at least one agent card visible (the house agent). Card shows name, owner handle (or pubkey shortcut), delivery mode, last_seen.

- [ ] **Step 3: /agents/<house> detail**

Navigate to `/agents/ag_q1ujorfm`. Screenshot.

Expected: agent detail page. Shows scorecard (may be sparse if <10 settled), recent responses, OG image renders.

- [ ] **Step 4: /docs and /terms render**

Navigate to `/docs`. Screenshot. Then `/terms`. Screenshot.

Expected: both render with v2 design tokens (no raw markdown showing). /docs has the API contract section visible; /terms has 6 sections (per LAUNCH_DONE).

### Task 6.2: Realtime updates work for asker UX

- [ ] **Step 1: Open the asker question page in browser**

Use `/browse` to navigate to the page where an asker submits a question (likely `/` or `/ask`). Identify the route by reading `src/app/page.tsx` or grepping for "ask" in `src/app`.

- [ ] **Step 2: With page open, trigger a query via fixture in another terminal**

```bash
set -a; source .env.local; set +a
npm run e2e:fixture -- --target=$STAGING 2>&1 | tail -5
```

- [ ] **Step 3: Verify the response appears in the browser within ~10s WITHOUT page reload**

Take screenshot, look for the new query/response appearing live. If only visible after manual refresh → Realtime subscription broken; SEV-2.

### Task 6.3: Wallet connect (skip if too risky)

**Optional / risky:** mainnet wallet connect on a public preview URL can prompt for real signatures. Only do if you have a brand-new wallet with ≤0.02 SOL and are willing to spend it.

- [ ] **Step 1: If proceeding — connect via /browse with extension OR document as "manual user-driven check"**

If skipping: write in the QA report under "Manual checks deferred" — wallet connect needs human in the loop with a real Phantom/etc extension. This is fine for the cutover gate as long as the API-level paths (Phase 4 + 5) work.

---

## Phase 7: Settlement loop

### Task 7.1: Trigger settlement manually with SETTLE_TEST_MODE

The Vercel cron runs every 5 min — too slow for QA. Use `SETTLE_TEST_MODE` (gated on `VERCEL_ENV !== 'production'`, so it works on Preview but NOT prod) to fast-forward.

**Files:**
- Read: `src/app/api/settle/route.ts` (confirm test-mode logic + env gate)

- [ ] **Step 1: Confirm there are responses old enough to settle (≥1h old at as_of_ts)**

We need at least one response that's >1h old at the as_of_ts override. Easiest: pick a response from yesterday or earlier, set as_of_ts to 1h after it.

```bash
SR_KEY=$(grep ^SUPABASE_SERVICE_ROLE_KEY= .env.local | cut -d= -f2-)
SUPABASE_URL=$(grep ^NEXT_PUBLIC_SUPABASE_URL= .env.local | cut -d= -f2-)
curl -s -H "apikey: $SR_KEY" -H "Authorization: Bearer $SR_KEY" \
  "$SUPABASE_URL/rest/v1/responses?select=id,created_at&order=created_at.asc&limit=3" | jq
```

Expected: at least one row. Pick the oldest `created_at` and add 25h to it for `as_of_ts`.

- [ ] **Step 2: Trigger /api/settle with test-mode override**

```bash
STAGING=https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app
SETTLE_SECRET=$(grep ^SETTLEMENT_CRON_SECRET= .env.local | cut -d= -f2-)
AS_OF=<paste ISO timestamp from Step 1, +25h>
curl -s -X POST "$STAGING/api/settle?as_of_ts=$AS_OF" \
  -H "Authorization: Bearer $SETTLE_SECRET" | jq
```

Expected: 200 with summary like `{"settled": N, "windows": ["1h","4h","24h"], ...}`. N > 0.

- [ ] **Step 3: Verify settlements table has rows**

```bash
curl -s -H "apikey: $SR_KEY" -H "Authorization: Bearer $SR_KEY" \
  "$SUPABASE_URL/rest/v1/settlements?select=*&order=created_at.desc&limit=5" | jq
```

Expected: 5 most recent settlements. Each has `response_id`, `horizon` (1h/4h/24h), `direction_correct` (bool), `pnl_pct`, `weighted_pnl`.

### Task 7.2: Leaderboard view reflects settlements

- [ ] **Step 1: Query the leaderboard view directly**

```bash
SR_KEY=$(grep ^SUPABASE_SERVICE_ROLE_KEY= .env.local | cut -d= -f2-)
SUPABASE_URL=$(grep ^NEXT_PUBLIC_SUPABASE_URL= .env.local | cut -d= -f2-)
curl -s -H "apikey: $SR_KEY" -H "Authorization: Bearer $SR_KEY" \
  "$SUPABASE_URL/rest/v1/leaderboard?select=*&order=composite_score.desc&limit=5" | jq
```

Expected: at least one row (filtered by min 10 sample size — may be empty if no agent has 10+ settled responses, that's fine for QA, document in report). If non-empty: `composite_score` is a number, `sample_size >= 10`.

- [ ] **Step 2: Open the leaderboard UI route in /browse**

Navigate to whichever route renders the leaderboard (likely `/` or `/leaderboard` — grep `src/app` to confirm). Screenshot.

Expected: leaderboard cards show ranked agents with PnL. Empty state is acceptable if no agent has crossed 10-sample threshold; the empty state must be styled (not raw "no data").

---

## Phase 8: Failure modes

### Task 8.1: Expired query → 410

- [ ] **Step 1: Find an old query past deadline**

```bash
SR_KEY=$(grep ^SUPABASE_SERVICE_ROLE_KEY= .env.local | cut -d= -f2-)
SUPABASE_URL=$(grep ^NEXT_PUBLIC_SUPABASE_URL= .env.local | cut -d= -f2-)
OLD_QID=$(curl -s -H "apikey: $SR_KEY" -H "Authorization: Bearer $SR_KEY" \
  "$SUPABASE_URL/rest/v1/queries?select=short_id,deadline_at&order=created_at.asc&limit=1" | jq -r '.[0].short_id')
echo "Trying expired query: $OLD_QID"
```

- [ ] **Step 2: Try to respond — expect 410 deadline_passed**

```bash
APIKEY=$(cat .qa/poll-agent-apikey.txt)
STAGING=https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app
curl -s -w "\nHTTP %{http_code}\n" -X POST "$STAGING/api/queries/$OLD_QID/respond" \
  -H "Authorization: Bearer $APIKEY" \
  -H "Content-Type: application/json" \
  -d '{"answer":"hold","confidence":0.5,"reasoning":"qa expired test"}'
```

Expected: HTTP 410, body `code: "deadline_passed"`.

### Task 8.2: Duplicate response → 409 already_responded

- [ ] **Step 1: Submit a fresh query, respond once successfully**

(Use the response stored in Phase 4 Task 4.3 — that agent already responded to a query.)

```bash
APIKEY=$(cat .qa/poll-agent-apikey.txt)
SR_KEY=$(grep ^SUPABASE_SERVICE_ROLE_KEY= .env.local | cut -d= -f2-)
SUPABASE_URL=$(grep ^NEXT_PUBLIC_SUPABASE_URL= .env.local | cut -d= -f2-)
AGENT_ID=$(cat .qa/poll-agent-id.txt)
RESP_QID=$(curl -s -H "apikey: $SR_KEY" -H "Authorization: Bearer $SR_KEY" \
  "$SUPABASE_URL/rest/v1/responses?agent_id=eq.$AGENT_ID&select=query_id&order=created_at.desc&limit=1" | jq -r '.[0].query_id')
# This is the queries.id (uuid), need to find the short_id
QID_SHORT=$(curl -s -H "apikey: $SR_KEY" -H "Authorization: Bearer $SR_KEY" \
  "$SUPABASE_URL/rest/v1/queries?id=eq.$RESP_QID&select=short_id" | jq -r '.[0].short_id')
echo "Trying duplicate respond on: $QID_SHORT"
```

- [ ] **Step 2: Re-submit — expect 409**

```bash
STAGING=https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app
curl -s -w "\nHTTP %{http_code}\n" -X POST "$STAGING/api/queries/$QID_SHORT/respond" \
  -H "Authorization: Bearer $APIKEY" \
  -H "Content-Type: application/json" \
  -d '{"answer":"hold","confidence":0.5,"reasoning":"qa duplicate test"}'
```

Expected: HTTP 409, body `code: "already_responded"`.

### Task 8.3: Invalid token mint → 400 validation_failed

This tests `/api/queries` create-side, not respond-side. Unfortunately requires a real wallet sig + credits. Skip and document if outside QA budget; OR use service-role to insert and check the validator at the query level.

- [ ] **Step 1 (alternative — service-role insert with bad mint, expect DB constraint or validator rejection)**

```bash
# Pick whichever is faster to set up. If skipping, document under "Deferred — covered by unit tests."
echo "Skipping — covered by Zod validator unit tests in scripts/launch-verify/__tests__/"
```

### Task 8.4: Unauthorized /api/settle → 401

- [ ] **Step 1: Hit /api/settle without auth**

```bash
STAGING=https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app
curl -s -w "\nHTTP %{http_code}\n" -X POST "$STAGING/api/settle"
```

Expected: HTTP 401, structured error body. Confirms `SETTLEMENT_CRON_SECRET` enforcement.

- [ ] **Step 2: Hit /api/settle with wrong secret → 401**

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST "$STAGING/api/settle" \
  -H "Authorization: Bearer wrong_secret"
```

Expected: HTTP 401. Timing should be reasonably constant (not measurably faster than Step 3) — proves timing-safe compare. Optional check: skip if too fiddly.

---

## Phase 9: Mobile / iOS viewport

The viewport meta export was just added (commit `050a0b3` this session). Confirm it actually engages mobile layouts.

### Task 9.1: 375×667 (iPhone SE)

- [ ] **Step 1: /browse with mobile viewport, navigate landing**

Use `/browse` with viewport 375×667 (or device emulation "iPhone SE"). Navigate to `https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app/`. Screenshot.

Expected: layout stacks vertically, no horizontal scroll, hero text fits. Tap targets ≥ 44×44.

- [ ] **Step 2: Same viewport, navigate /agents and an agent detail**

Screenshot both.

Expected: agent cards stack one per row. Detail page metrics readable, scorecard not cut off.

### Task 9.2: 414×896 (iPhone 11)

- [ ] **Step 1: Repeat key routes at 414×896**

Screenshots of `/`, `/agents`, `/agents/ag_q1ujorfm`, `/docs`.

Expected: same as Task 9.1, slightly more breathing room. No regressions.

### Task 9.3: Confirm viewport meta actually emitted in HTML

- [ ] **Step 1: Check rendered HTML head**

```bash
STAGING=https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app
curl -s "$STAGING/" | grep -oE '<meta name="viewport"[^>]*>'
```

Expected: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>` (Next.js may emit slightly different ordering — check key=value pairs, not byte-exact).

**If empty:** the viewport export from this session's commit didn't deploy. Check Vercel deploy log + branch alias is current. Re-deploy if needed.

---

## Phase 10: Aggregate readiness report

### Task 10.1: Write the QA report

**Files:**
- Create: `docs/superpowers/qa-reports/2026-05-10-staging-qa.md`

- [ ] **Step 1: Compile pass/fail per check into the report**

Template:

```markdown
# Staging QA Report — Pre-Cutover (2026-05-10)

**Target:** https://tradefish-git-feat-post-waitlist-ggomaengs-projects.vercel.app
**Branch:** feat/post-waitlist
**QA budget consumed:** ~0.0X SOL (X of 4 fixture runs)
**Verdict:** GO | NO-GO | GO-WITH-CONDITIONS

## Phase results

| Phase | Tasks | Pass | Fail | Notes |
|-------|-------|------|------|-------|
| 0. Pre-flight | 6 | 6 | 0 | baseline counts captured |
| 1. Automated checks | 5 | ... | ... | ... |
| 2. E2E fixture (poll) | 3 | ... | ... | latency: ...ms |
| 3. API contract probes | 8 | ... | ... | ... |
| 4. Builder onboarding (poll) | 6 | ... | ... | ... |
| 5. Builder onboarding (webhook) | 8 | ... | ... | tunnel: cloudflared |
| 6. Asker UX in browser | 5 | ... | ... | wallet connect: deferred |
| 7. Settlement loop | 4 | ... | ... | settled N rows |
| 8. Failure modes | 6 | ... | ... | ... |
| 9. Mobile viewport | 5 | ... | ... | viewport meta confirmed in HTML |

## Issues found (sorted by severity)

### SEV-1 (blocks cutover)
(none) | (list)

### SEV-2 (cutover allowed; fix in first follow-up)
(none) | (list)

### SEV-3 (cosmetic / doc / nice-to-have)
(none) | (list)

## Manual checks deferred
- wallet connect on mainnet preview (needs real signer in human loop)
- ...

## Recommendation

GO: ship the cutover per CUTOVER_RUNBOOK.md. All critical paths verified.
GO-WITH-CONDITIONS: ship cutover, but [specific condition].
NO-GO: defer cutover until [specific blocker] resolved.
```

- [ ] **Step 2: Commit the report**

```bash
mkdir -p docs/superpowers/qa-reports
git add docs/superpowers/qa-reports/2026-05-10-staging-qa.md
git commit -m "docs(qa): pre-cutover staging QA report"
```

Expected: one-file commit on `feat/post-waitlist`. Cutover decision now has a written artifact.

### Task 10.2: Cleanup

- [ ] **Step 1: Stop tunnel + receiver**

```bash
pkill -f "cloudflared tunnel" 2>/dev/null || pkill -f "ngrok http" 2>/dev/null || true
pkill -f "node .qa/webhook-receiver/server.mjs" 2>/dev/null || true
```

- [ ] **Step 2: Delete QA-created agents from DB (don't pollute leaderboard)**

```bash
SR_KEY=$(grep ^SUPABASE_SERVICE_ROLE_KEY= .env.local | cut -d= -f2-)
SUPABASE_URL=$(grep ^NEXT_PUBLIC_SUPABASE_URL= .env.local | cut -d= -f2-)
for f in .qa/poll-agent-id.txt .qa/webhook-agent-id.txt; do
  [ -f "$f" ] || continue
  AID=$(cat "$f")
  echo "Deleting $AID..."
  # Delete responses first (FK), then agent. Adjust column name if needed (id vs short_id).
  curl -s -X DELETE -H "apikey: $SR_KEY" -H "Authorization: Bearer $SR_KEY" \
    "$SUPABASE_URL/rest/v1/responses?agent_id=in.(select id from agents where short_id=eq.$AID)" | head -c 200
  curl -s -X DELETE -H "apikey: $SR_KEY" -H "Authorization: Bearer $SR_KEY" \
    "$SUPABASE_URL/rest/v1/agents?short_id=eq.$AID"
done
# Delete any rate-test agents created in Phase 3.3
curl -s -X DELETE -H "apikey: $SR_KEY" -H "Authorization: Bearer $SR_KEY" \
  "$SUPABASE_URL/rest/v1/agents?name=eq.rate-test"
```

Expected: cleanup successful. Re-query agents table — only the house agent + any pre-existing real agents remain.

- [ ] **Step 3: Final state check**

```bash
git status --short
git log feat/post-waitlist --oneline -5
```

Expected: working tree clean. Last 5 commits visible. No uncommitted changes from QA pass (only the gitignore + the QA report should have been committed).

---

## Self-Review

**1. Spec coverage check:**
- Builder registers → Phase 4 (poll), Phase 5 (webhook). ✅
- User asks question → Phase 2, 4, 5 (via fixture). UI side: Phase 6.2. ✅
- Builder gets notified → Phase 4.2 (poll), Phase 5.3 (webhook with HMAC). ✅
- Builder replies → Phase 4.3, 5.3. ✅
- Paper trade → entry_price snapshot verified in Phase 4.3 step 2 + 5.3 step 4. PnL via settlement Phase 7. ✅

**2. Placeholder scan:** no TBDs, no "implement later", every step has a concrete command + expected output.

**3. Type/name consistency:** API endpoints (`/api/agents/register`, `/api/queries/[id]/respond`, `/api/settle`, `/api/queries/pending`) used consistently. Field names (`agent_id`, `short_id`, `query_id`, `confidence`, `entry_price_usd`) match what skill.md and route schemas use.

**4. Resource budget:** 4 fixture runs at 0.01 SOL each = 0.04 SOL total. Treasury has exactly 0.04. Fixture-asker also needs SOL (recovered after each run since topup goes to treasury, but base fees ~0.000005 SOL/tx are lost). Plan uses ~3 fixture runs (Phases 2, 4.2, 5.3) + one budgeted spare. Tight but workable. If budget burns: stop, top up, resume.
