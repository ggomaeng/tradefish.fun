/**
 * POST /api/credits/topup
 *
 * Server-verified credit grant. Body: { signature, wallet_pubkey }.
 *
 * The on-chain truth is the SystemProgram.transfer from the user's wallet
 * to NEXT_PUBLIC_TRADEFISH_TREASURY. We re-fetch the transaction via the
 * Solana RPC, verify the destination + lamports + payer, then atomically:
 *   1. INSERT into `topups` (UNIQUE on signature → idempotency guard)
 *   2. UPSERT `wallet_credits` adding `floor(lamports / 1_000_000)` credits
 *
 * If the RPC node hasn't finalized the tx yet we return 404; the client
 * should retry with backoff. If the signature already exists we return the
 * current balance so the client can render success either way.
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import {
  Connection,
  PublicKey,
  SystemProgram,
  type ParsedInstruction,
  type ParsedTransactionWithMeta,
} from "@solana/web3.js";
import { dbAdmin } from "@/lib/db";
import { enforce, rateLimitedResponse, subjectFromRequest } from "@/lib/rate-limit";
import { apiError, logError, requestId } from "@/lib/api-error";

const ROUTE = "/api/credits/topup";

const LAMPORTS_PER_CREDIT = 1_000_000;
const MIN_LAMPORTS = 10_000_000; // 0.01 SOL minimum (= 10 credits)

const Body = z.object({
  signature: z.string().min(32).max(120),
  wallet_pubkey: z.string().min(32).max(64),
});

export async function POST(request: NextRequest) {
  const rid = requestId(request);

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError({
      error: "validation_failed",
      code: "validation_failed",
      status: 400,
      request_id: rid,
      extra: { issues: parsed.error.issues },
    });
  }
  const { signature, wallet_pubkey } = parsed.data;

  // Rate limit: 10 RPM keyed on the topping-up wallet (RUNBOOK §3).
  const rl = await enforce({
    subject: subjectFromRequest(request, wallet_pubkey),
    route: ROUTE,
    window_seconds: 60,
    max_count: 10,
  });
  if (!rl.ok) return rateLimitedResponse(rl);

  const treasuryEnv = process.env.NEXT_PUBLIC_TRADEFISH_TREASURY;
  const rpcEnv = process.env.NEXT_PUBLIC_SOLANA_RPC;
  if (!treasuryEnv) {
    logError({ route: ROUTE, code: "treasury_unconfigured", request_id: rid });
    return apiError({
      error: "treasury_unconfigured",
      code: "treasury_unconfigured",
      status: 500,
      request_id: rid,
    });
  }
  if (!rpcEnv) {
    logError({ route: ROUTE, code: "rpc_unconfigured", request_id: rid });
    return apiError({
      error: "rpc_unconfigured",
      code: "rpc_unconfigured",
      status: 500,
      request_id: rid,
    });
  }

  let treasury: PublicKey;
  let payer: PublicKey;
  try {
    treasury = new PublicKey(treasuryEnv);
    payer = new PublicKey(wallet_pubkey);
  } catch {
    return apiError({
      error: "invalid_pubkey",
      code: "invalid_pubkey",
      status: 400,
      request_id: rid,
    });
  }

  const db = dbAdmin();

  // Idempotency: if we've already credited this signature, short-circuit.
  const { data: existing } = await db
    .from("topups")
    .select("signature, wallet_pubkey, lamports, credits_added")
    .eq("signature", signature)
    .maybeSingle();
  if (existing) {
    if (existing.wallet_pubkey !== wallet_pubkey) {
      return apiError({
        error: "signature_owned_by_other_wallet",
        code: "signature_owned_by_other_wallet",
        status: 409,
        request_id: rid,
      });
    }
    const balance = await fetchBalance(wallet_pubkey);
    return Response.json({
      ok: true,
      idempotent: true,
      credits: balance,
      signature,
      lamports: Number(existing.lamports),
      explorer_url: explorerUrl(signature),
    });
  }

  // Fetch the on-chain transaction. Parsed form is easier to inspect for the
  // SystemProgram.transfer instruction.
  const connection = new Connection(rpcEnv, "confirmed");
  let tx: ParsedTransactionWithMeta | null = null;
  try {
    tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
  } catch (err) {
    logError({ route: ROUTE, code: "rpc_error", request_id: rid, err });
    return apiError({
      error: "rpc_error",
      code: "rpc_error",
      status: 502,
      request_id: rid,
      extra: { detail: err instanceof Error ? err.message : "unknown" },
    });
  }

  if (!tx) {
    return apiError({
      error: "tx_not_found",
      code: "tx_not_found",
      status: 404,
      request_id: rid,
      extra: { retry: true },
    });
  }
  if (tx.meta?.err) {
    return apiError({
      error: "tx_failed_on_chain",
      code: "tx_failed_on_chain",
      status: 400,
      request_id: rid,
      extra: { detail: tx.meta.err },
    });
  }

  // Walk parsed instructions for a SystemProgram.transfer that matches.
  const transfer = findMatchingTransfer(tx, payer, treasury);
  if (!transfer) {
    return apiError({
      error: "no_matching_transfer",
      code: "no_matching_transfer",
      status: 400,
      request_id: rid,
    });
  }
  if (transfer.lamports < MIN_LAMPORTS) {
    return apiError({
      error: "insufficient_lamports",
      code: "insufficient_lamports",
      status: 400,
      request_id: rid,
      extra: { required: MIN_LAMPORTS, actual: transfer.lamports },
    });
  }

  const credits_added = Math.floor(transfer.lamports / LAMPORTS_PER_CREDIT);
  const blockTime = tx.blockTime
    ? new Date(tx.blockTime * 1000).toISOString()
    : null;

  // Insert the topup row first. The UNIQUE(signature) constraint is the
  // idempotency guard — if a concurrent request beats us, this errors and
  // we fall through to read the canonical balance.
  const { error: insertErr } = await db.from("topups").insert({
    signature,
    wallet_pubkey,
    lamports: transfer.lamports,
    credits_added,
    status: "confirmed",
    block_time: blockTime,
  });

  if (insertErr) {
    // 23505 = unique_violation (Postgres). Anything else is real.
    const code = (insertErr as { code?: string }).code;
    if (code !== "23505") {
      logError({ route: ROUTE, code: "topup_insert_failed", request_id: rid, err: insertErr });
      return apiError({
        error: "topup_insert_failed",
        code: "topup_insert_failed",
        status: 500,
        request_id: rid,
        extra: { detail: insertErr.message },
      });
    }
    // Lost the race — another request already credited. Return current balance.
    const balance = await fetchBalance(wallet_pubkey);
    return Response.json({
      ok: true,
      idempotent: true,
      credits: balance,
      signature,
      lamports: transfer.lamports,
      explorer_url: explorerUrl(signature),
    });
  }

  // Upsert wallet_credits, adding the new credits. We do this in two reads
  // to keep the SQL portable — the topups insert above is the real guard,
  // so a brief race here can only undercount; the next topup will reconcile.
  const { data: current } = await db
    .from("wallet_credits")
    .select("credits, total_topped_up_lamports")
    .eq("wallet_pubkey", wallet_pubkey)
    .maybeSingle();

  const newCredits = (current?.credits ?? 0) + credits_added;
  const newTotalLamports =
    Number(current?.total_topped_up_lamports ?? 0) + transfer.lamports;

  const { error: upsertErr } = await db
    .from("wallet_credits")
    .upsert(
      {
        wallet_pubkey,
        credits: newCredits,
        total_topped_up_lamports: newTotalLamports,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "wallet_pubkey" },
    );

  if (upsertErr) {
    logError({ route: ROUTE, code: "credit_grant_failed", request_id: rid, err: upsertErr });
    return apiError({
      error: "credit_grant_failed",
      code: "credit_grant_failed",
      status: 500,
      request_id: rid,
      extra: { detail: upsertErr.message },
    });
  }

  return Response.json({
    ok: true,
    credits: newCredits,
    credits_added,
    signature,
    lamports: transfer.lamports,
    explorer_url: explorerUrl(signature),
  });
}

async function fetchBalance(wallet_pubkey: string): Promise<number> {
  const db = dbAdmin();
  const { data } = await db
    .from("wallet_credits")
    .select("credits")
    .eq("wallet_pubkey", wallet_pubkey)
    .maybeSingle();
  return data?.credits ?? 0;
}

function explorerUrl(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

/**
 * Walk parsed instructions (top-level + inner) for a SystemProgram.transfer
 * matching `from = payer` and `to = treasury`. Returns the lamports value or null.
 */
function findMatchingTransfer(
  tx: ParsedTransactionWithMeta,
  payer: PublicKey,
  treasury: PublicKey,
): { lamports: number } | null {
  const treasuryStr = treasury.toBase58();
  const payerStr = payer.toBase58();
  const systemProgramStr = SystemProgram.programId.toBase58();

  const all: ParsedInstruction[] = [];
  for (const ix of tx.transaction.message.instructions) {
    if ("parsed" in ix) all.push(ix as ParsedInstruction);
  }
  for (const inner of tx.meta?.innerInstructions ?? []) {
    for (const ix of inner.instructions) {
      if ("parsed" in ix) all.push(ix as ParsedInstruction);
    }
  }

  for (const ix of all) {
    if (ix.programId.toBase58() !== systemProgramStr) continue;
    const parsed = ix.parsed as
      | { type?: string; info?: { source?: string; destination?: string; lamports?: number } }
      | undefined;
    if (!parsed || parsed.type !== "transfer") continue;
    const info = parsed.info;
    if (!info) continue;
    if (info.source !== payerStr) continue;
    if (info.destination !== treasuryStr) continue;
    if (typeof info.lamports !== "number") continue;
    return { lamports: info.lamports };
  }
  return null;
}
