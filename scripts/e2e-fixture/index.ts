// scripts/e2e-fixture/index.ts
//
// End-to-end fixture for the live TradeFish staging system.
//
// Per RUNBOOK §6 + §7:
//   - Reads fixture-asker keypair from secrets/fixture-asker.json
//   - Verifies balance >= MIN_FIXTURE_ASKER_BALANCE_LAMPORTS
//   - Registers an EPHEMERAL throwaway agent (so we don't pollute leaderboard)
//   - Tops up the fixture-asker via SystemProgram.transfer to treasury, then
//     POSTs the signature to /api/credits/topup so credits are granted
//   - Submits one query as the fixture-asker (token = SOL, buy_sell_now)
//   - Polls responses table (via service-role) up to 30s; expects house agent
//     ag_q1ujorfm to respond
//   - Tears down: deletes the ephemeral agent + the test query from DB
//   - Prints structured JSON summary; exit 0 on success, non-zero on failure
//
// Invocation:
//   npm run e2e:fixture -- --target=https://...vercel.app
//   npm run e2e:fixture -- --target=... --dry-run
//
// Env required:
//   SUPABASE_SERVICE_ROLE_KEY (for teardown + response polling). If absent,
//   teardown is skipped with a warning and exit code is 2.
//   NEXT_PUBLIC_SUPABASE_URL
//
// Hard constraints:
//   - Never echoes keypair secrets
//   - Never broadcasts a tx in --dry-run mode
//   - On treasury-unfunded / fixture-underfunded, appends to BLOCKED.md
//     and exits non-zero with funding_required outcome.

import { readFileSync, existsSync, appendFileSync } from "node:fs";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { createClient } from "@supabase/supabase-js";

// ──────────────────────────────────────────────────────────────────────────
// Constants (RUNBOOK §6 + code's actual MIN_LAMPORTS)
// ──────────────────────────────────────────────────────────────────────────

// /api/credits/topup MIN_LAMPORTS is 10_000_000 = 0.01 SOL = 10 credits.
// One query costs 10 credits. So per-run topup MUST be >= 0.01 SOL even
// though RUNBOOK §6 said 0.001 SOL. Documented as deviation in the report.
export const PER_RUN_TOPUP_LAMPORTS = 10_000_000; // 0.01 SOL = 10 credits = 1 query

// RUNBOOK §6 spec: >= 5_000_000. We bump to >= topup + buffer so one full run
// can actually complete. Keep both to surface the funding problem clearly.
export const MIN_FIXTURE_ASKER_BALANCE_LAMPORTS = PER_RUN_TOPUP_LAMPORTS + 1_000_000; // 0.011 SOL

export const RESPONSE_POLL_TIMEOUT_MS = 30_000;
export const RESPONSE_POLL_INTERVAL_MS = 1_500;

export const HOUSE_AGENT_SHORT_ID = "ag_q1ujorfm";
export const SOL_MINT = "So11111111111111111111111111111111111111112";

const FIXTURE_KEYPAIR_PATH = "secrets/fixture-asker.json";
const BLOCKED_PATH = ".loop-state/BLOCKED.md";

// ──────────────────────────────────────────────────────────────────────────
// CLI args
// ──────────────────────────────────────────────────────────────────────────

interface CliArgs {
  target: string | null;
  dryRun: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  let target: string | null = process.env.E2E_FIXTURE_TARGET ?? null;
  let dryRun = false;
  for (const a of argv) {
    if (a.startsWith("--target=")) target = a.slice("--target=".length);
    else if (a === "--dry-run") dryRun = true;
  }
  if (target) target = target.replace(/\/+$/, "");
  return { target, dryRun };
}

// ──────────────────────────────────────────────────────────────────────────
// Output shape
// ──────────────────────────────────────────────────────────────────────────

export interface RunSummary {
  outcome:
    | "ok"
    | "dry_run_ok"
    | "funding_required"
    | "treasury_unfunded"
    | "no_house_response"
    | "register_failed"
    | "topup_failed"
    | "ask_failed"
    | "teardown_skipped"
    | "failed";
  query_id: string | null;
  ephemeral_agent_id: string | null;
  house_agent_responded: boolean;
  latency_ms: number | null;
  balances_before: {
    fixture_asker_lamports: number | null;
    treasury_lamports: number | null;
  };
  balances_after: {
    fixture_asker_lamports: number | null;
    treasury_lamports: number | null;
  };
  detail?: string;
  target?: string;
  dry_run?: boolean;
}

export function makeEmptySummary(): RunSummary {
  return {
    outcome: "failed",
    query_id: null,
    ephemeral_agent_id: null,
    house_agent_responded: false,
    latency_ms: null,
    balances_before: { fixture_asker_lamports: null, treasury_lamports: null },
    balances_after: { fixture_asker_lamports: null, treasury_lamports: null },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

export function loadFixtureKeypair(path = FIXTURE_KEYPAIR_PATH): Keypair {
  if (!existsSync(path)) {
    throw new Error(`fixture-asker keypair not found at ${path}`);
  }
  const raw = readFileSync(path, "utf-8");
  const arr = JSON.parse(raw) as number[];
  if (!Array.isArray(arr) || arr.length !== 64) {
    throw new Error(`fixture-asker keypair at ${path} is malformed`);
  }
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}

export function checkBalanceSufficient(
  lamports: number,
  min = MIN_FIXTURE_ASKER_BALANCE_LAMPORTS,
): { ok: boolean; needed: number; have: number } {
  return { ok: lamports >= min, needed: min, have: lamports };
}

export function appendBlocker(message: string, path = BLOCKED_PATH): void {
  // Keep this idempotent-ish: only append if the message isn't already present.
  try {
    const existing = existsSync(path) ? readFileSync(path, "utf-8") : "";
    if (existing.includes(message.split("\n")[0]!)) return; // first line dedup
    appendFileSync(path, `\n${message}\n`);
  } catch {
    // Best-effort — never throw from BLOCKED writer.
  }
}

function getNetworkUrlsFromTarget(): {
  rpcUrl: string;
  treasuryPubkey: string;
} {
  // The script may be invoked outside Next.js context; allow env to drive.
  // For mainnet (the launch case): NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta.
  // We don't import lib/solana-config because it's bound to Next env loading;
  // mirroring the resolution logic keeps the script standalone.
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet";
  const defaultRpc =
    network === "mainnet-beta"
      ? "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com";
  const defaultTreasury =
    network === "mainnet-beta"
      ? "CFgBLpStEPRZf2pHiUbccB731avjvUb7a9yBApu3jR7Y"
      : "GigzG9cDT2kamQRtkt6Njm4hXr2EFGRsL1NAGQ7RagSk";
  return {
    rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC || defaultRpc,
    treasuryPubkey: process.env.NEXT_PUBLIC_TRADEFISH_TREASURY || defaultTreasury,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// HTTP wrappers
// ──────────────────────────────────────────────────────────────────────────

async function httpJson(
  url: string,
  init: RequestInit & { headers?: Record<string, string> },
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const summary = makeEmptySummary();
  summary.dry_run = args.dryRun;

  if (!args.target) {
    summary.outcome = "failed";
    summary.detail =
      "missing --target=<URL> (or E2E_FIXTURE_TARGET env). Example: npm run e2e:fixture -- --target=https://staging.example.com";
    emit(summary);
    process.exit(2);
  }
  summary.target = args.target;

  // Load fixture-asker keypair (no logging of secrets).
  let fixtureAsker: Keypair;
  try {
    fixtureAsker = loadFixtureKeypair();
  } catch (err) {
    summary.outcome = "failed";
    summary.detail = `fixture-asker load failed: ${(err as Error).message}`;
    emit(summary);
    process.exit(2);
  }
  const fixtureAskerPubkey = fixtureAsker.publicKey.toBase58();

  const { rpcUrl, treasuryPubkey } = getNetworkUrlsFromTarget();
  const conn = new Connection(rpcUrl, "confirmed");

  // 1) Balance check (RUNBOOK §6 funding gate)
  let askerLamports = 0;
  let treasuryLamports = 0;
  try {
    askerLamports = await conn.getBalance(new PublicKey(fixtureAskerPubkey));
    treasuryLamports = await conn.getBalance(new PublicKey(treasuryPubkey));
  } catch (err) {
    summary.outcome = "failed";
    summary.detail = `RPC balance fetch failed: ${(err as Error).message}`;
    emit(summary);
    process.exit(3);
  }
  summary.balances_before = {
    fixture_asker_lamports: askerLamports,
    treasury_lamports: treasuryLamports,
  };

  const fixtureCheck = checkBalanceSufficient(askerLamports);
  if (!fixtureCheck.ok) {
    summary.outcome = "funding_required";
    summary.detail = `fixture-asker has ${askerLamports} lamports; need ${fixtureCheck.needed} (≥${fixtureCheck.needed / LAMPORTS_PER_SOL} SOL). Pubkey: ${fixtureAskerPubkey}`;
    appendBlocker(
      `## Fixture-asker funding [blocked-on-user]\n- Address: ${fixtureAskerPubkey}\n- Action required: send ${fixtureCheck.needed / LAMPORTS_PER_SOL} SOL on mainnet (network=${process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet"}) to this address before npm run e2e:fixture can pass\n- Discovered tick: 23`,
    );
    emit(summary);
    process.exit(4);
  }

  if (treasuryLamports === 0 && !args.dryRun) {
    // Topup will likely fail — surface gracefully.
    summary.outcome = "treasury_unfunded";
    summary.detail = `treasury ${treasuryPubkey} has 0 lamports; sending SOL to it works but downstream ops requiring treasury balance (gas, payouts) will fail. Continuing anyway — topup is one-way credit so it should still succeed.`;
    // do NOT exit — let's still try the topup; treasury just receives SOL.
    // Reset outcome so downstream code can override.
    summary.outcome = "failed";
  }

  // 2) (Reserved) ephemeral throwaway keypair — we register the agent with
  //    delivery=poll and never claim it (no owner_pubkey), so we don't need
  //    to sign anything. Keep this comment as the contract for future ticks
  //    that may decide to claim the ephemeral agent for fuller coverage.

  // 3) Register ephemeral agent. delivery=poll so we never need to expose
  //    a webhook endpoint. We never run a runtime for it — it's a placeholder
  //    that proves the registration path works end-to-end.
  if (args.dryRun) {
    summary.outcome = "dry_run_ok";
    summary.detail =
      "dry-run: balances ok; would register ephemeral agent, top up, ask, poll, teardown. No SOL broadcast.";
    summary.balances_after = summary.balances_before;
    emit(summary);
    process.exit(0);
  }

  const ephemeralName = `e2e-fixture-${randomTag()}`;
  let registerRes: { status: number; body: unknown };
  try {
    registerRes = await httpJson(`${args.target}/api/agents/register`, {
      method: "POST",
      body: JSON.stringify({
        name: ephemeralName,
        description: "ephemeral e2e fixture agent — auto-deleted after run",
        delivery: "poll",
      }),
    });
  } catch (err) {
    summary.outcome = "register_failed";
    summary.detail = `register fetch failed: ${(err as Error).message}`;
    emit(summary);
    process.exit(5);
  }
  if (registerRes.status !== 201) {
    summary.outcome = "register_failed";
    summary.detail = `register returned ${registerRes.status}: ${JSON.stringify(registerRes.body)}`;
    emit(summary);
    process.exit(5);
  }
  const regBody = registerRes.body as {
    agent_id: string;
    api_key: string;
    claim_url: string;
  };
  summary.ephemeral_agent_id = regBody.agent_id;

  // From here on, use a try/finally so teardown always runs.
  let exitCode = 0;
  try {
    // 4) Top up the fixture-asker.
    //    a) Build & send SystemProgram.transfer to treasury
    //    b) POST signature + wallet_pubkey to /api/credits/topup
    let topupSig: string;
    try {
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fixtureAsker.publicKey,
          toPubkey: new PublicKey(treasuryPubkey),
          lamports: PER_RUN_TOPUP_LAMPORTS,
        }),
      );
      const { blockhash, lastValidBlockHeight } =
        await conn.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = fixtureAsker.publicKey;
      tx.sign(fixtureAsker);
      topupSig = await conn.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
      await conn.confirmTransaction(
        { signature: topupSig, blockhash, lastValidBlockHeight },
        "confirmed",
      );
    } catch (err) {
      summary.outcome = "topup_failed";
      summary.detail = `on-chain transfer failed: ${(err as Error).message}`;
      exitCode = 6;
      return;
    }

    // Notify the platform so credits are granted server-side.
    let topupApi: { status: number; body: unknown };
    try {
      topupApi = await httpJson(`${args.target}/api/credits/topup`, {
        method: "POST",
        body: JSON.stringify({
          signature: topupSig,
          wallet_pubkey: fixtureAskerPubkey,
        }),
      });
    } catch (err) {
      summary.outcome = "topup_failed";
      summary.detail = `topup api fetch failed: ${(err as Error).message}`;
      exitCode = 7;
      return;
    }
    if (topupApi.status !== 200) {
      summary.outcome = "topup_failed";
      summary.detail = `topup api returned ${topupApi.status}: ${JSON.stringify(topupApi.body)}`;
      exitCode = 7;
      return;
    }

    // 5) Submit query as fixture-asker. Header-only auth via X-Wallet-Pubkey
    //    is sufficient (the credit gate is on wallet_pubkey).
    let askRes: { status: number; body: unknown };
    const askedAt = Date.now();
    try {
      askRes = await httpJson(`${args.target}/api/queries`, {
        method: "POST",
        headers: { "X-Wallet-Pubkey": fixtureAskerPubkey },
        body: JSON.stringify({
          token_mint: SOL_MINT,
          question_type: "buy_sell_now",
        }),
      });
    } catch (err) {
      summary.outcome = "ask_failed";
      summary.detail = `ask fetch failed: ${(err as Error).message}`;
      exitCode = 8;
      return;
    }
    if (askRes.status !== 201) {
      summary.outcome = "ask_failed";
      summary.detail = `ask returned ${askRes.status}: ${JSON.stringify(askRes.body)}`;
      exitCode = 8;
      return;
    }
    const askBody = askRes.body as { query_id: string };
    summary.query_id = askBody.query_id;

    // 6) Poll for house agent response via service-role DB.
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supaUrl || !svcKey) {
      summary.outcome = "teardown_skipped";
      summary.detail =
        "SUPABASE_SERVICE_ROLE_KEY missing — cannot poll responses or teardown. Set env and re-run.";
      exitCode = 2;
      return;
    }
    const db = createClient(supaUrl, svcKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: houseAgent } = await db
      .from("agents")
      .select("id")
      .eq("short_id", HOUSE_AGENT_SHORT_ID)
      .maybeSingle();
    const houseAgentUuid = (houseAgent?.id as string | undefined) ?? null;

    const { data: queryRow } = await db
      .from("queries")
      .select("id")
      .eq("short_id", askBody.query_id)
      .maybeSingle();
    const queryUuid = (queryRow?.id as string | undefined) ?? null;
    if (!queryUuid) {
      summary.outcome = "ask_failed";
      summary.detail = `query short_id=${askBody.query_id} not found in DB after insert`;
      exitCode = 9;
      return;
    }

    const houseRespondedAt = await pollForHouseResponse(
      db,
      queryUuid,
      houseAgentUuid,
      RESPONSE_POLL_TIMEOUT_MS,
      RESPONSE_POLL_INTERVAL_MS,
    );

    if (houseRespondedAt === null) {
      summary.outcome = "no_house_response";
      summary.detail = `house agent ${HOUSE_AGENT_SHORT_ID} did not respond within ${RESPONSE_POLL_TIMEOUT_MS}ms`;
      exitCode = 10;
      // fall through to teardown
    } else {
      summary.house_agent_responded = true;
      summary.latency_ms = houseRespondedAt.getTime() - askedAt;
      summary.outcome = "ok";
    }

    // 7) Teardown: delete query + ephemeral agent rows.
    try {
      await db.from("queries").delete().eq("id", queryUuid);
    } catch (err) {
      summary.detail = `${summary.detail ?? ""}; teardown query delete failed: ${(err as Error).message}`;
    }
    try {
      // delete agent by short_id; cascades to responses by FK
      await db.from("agents").delete().eq("short_id", regBody.agent_id);
    } catch (err) {
      summary.detail = `${summary.detail ?? ""}; teardown agent delete failed: ${(err as Error).message}`;
    }

    // Re-fetch balances after the run.
    try {
      const after = await conn.getBalance(new PublicKey(fixtureAskerPubkey));
      const treasuryAfter = await conn.getBalance(new PublicKey(treasuryPubkey));
      summary.balances_after = {
        fixture_asker_lamports: after,
        treasury_lamports: treasuryAfter,
      };
    } catch {
      // non-fatal
    }
  } finally {
    emit(summary);
    process.exit(exitCode);
  }
}

// Type-erased Supabase client to avoid generic inference fights between the
// call site (no schema) and this helper.
type SupabaseLite = {
  from: (t: string) => unknown;
};

async function pollForHouseResponse(
  db: SupabaseLite,
  queryUuid: string,
  houseAgentUuid: string | null,
  timeoutMs: number,
  intervalMs: number,
): Promise<Date | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // Build the query with the chained Supabase API. Cast to a permissive
    // shape since the typed schema isn't loaded for scripts.
    type Q = {
      select: (c: string) => Q;
      eq: (col: string, val: string) => Q;
      then: (resolve: (v: { data: unknown }) => void) => void;
    };
    let q = (db.from("responses") as unknown as Q)
      .select("agent_id, responded_at")
      .eq("query_id", queryUuid);
    if (houseAgentUuid) q = q.eq("agent_id", houseAgentUuid);
    const { data } = await new Promise<{ data: unknown }>((resolve) =>
      q.then(resolve),
    );
    const arr = (data ?? []) as Array<{ agent_id: string; responded_at: string }>;
    const row = arr[0];
    if (row) return new Date(row.responded_at);
    await sleep(intervalMs);
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function randomTag(): string {
  return Math.random().toString(36).slice(2, 10);
}

function emit(s: RunSummary): void {
  // Single JSON line to stdout; logs to stderr so they don't pollute the
  // machine-readable summary.
  process.stdout.write(JSON.stringify(s) + "\n");
}

// Only run if invoked directly (skip during vitest imports).
const isUnderVitest =
  !!process.env.VITEST || !!process.env.VITEST_WORKER_ID;
if (!isUnderVitest) {
  main().catch((err) => {
    const s = makeEmptySummary();
    s.outcome = "failed";
    s.detail = `unhandled: ${(err as Error).message}`;
    emit(s);
    process.exit(99);
  });
}
