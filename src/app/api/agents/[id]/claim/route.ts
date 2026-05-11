/**
 * POST /api/agents/<id>/claim
 *
 * Wallet-signature claim flow.
 *
 * Body:
 *   {
 *     token:         string,                   // claim token from registration
 *     wallet_pubkey: string,                   // base58 Solana pubkey (32 bytes)
 *     signature?:    string,                   // base58 signature, required unless demo=true
 *     demo?:         boolean,                  // hackathon convenience: skip sig check
 *   }
 *
 * Expected signed message (UTF-8):
 *
 *   tradefish:claim:<token>:<short_id>
 *
 * On success: agents.claimed=true, owner_pubkey=<wallet>, claimed_at=now().
 *
 * 200 → claim recorded
 * 400 → bad body / verification failed shape
 * 401 → signature rejected
 * 404 → no agent with short_id
 * 409 → already claimed (returns current owner_pubkey)
 */
import { type NextRequest } from "next/server";
import { z } from "zod";
import nacl from "tweetnacl";
import bs58 from "bs58";

import { dbAdmin } from "@/lib/db";
import { apiError, logError, requestId } from "@/lib/api-error";

const ROUTE = "/api/agents/[id]/claim";

const Schema = z.object({
  token: z.string().min(1),
  wallet_pubkey: z.string().min(32).max(48),
  signature: z.string().optional(),
  demo: z.boolean().optional(),
});

function buildClaimMessage(token: string, shortId: string): string {
  return `tradefish:claim:${token}:${shortId}`;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const rid = requestId(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError({
      error: "invalid_json",
      code: "invalid_json",
      status: 400,
      request_id: rid,
    });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return apiError({
      error: "validation_failed",
      code: "validation_failed",
      status: 400,
      request_id: rid,
      extra: { issues: parsed.error.issues },
    });
  }
  const { token, wallet_pubkey, signature, demo } = parsed.data;

  // 1) Look up the agent by short_id.
  const db = dbAdmin();
  const { data: existing, error: lookupErr } = await db
    .from("agents")
    .select("id, short_id, claimed, owner_pubkey")
    .eq("short_id", id)
    .maybeSingle();

  if (lookupErr) {
    logError({ route: ROUTE, code: "lookup_failed", request_id: rid, err: lookupErr });
    return apiError({
      error: "lookup_failed",
      code: "lookup_failed",
      status: 500,
      request_id: rid,
    });
  }
  if (!existing) {
    return apiError({
      error: "not_found",
      code: "not_found",
      status: 404,
      request_id: rid,
    });
  }

  // 2) Reject if already claimed (idempotency: caller can re-poll GET /api/agents/<id>).
  if (existing.claimed) {
    return apiError({
      error: "already_claimed",
      code: "already_claimed",
      status: 409,
      request_id: rid,
      extra: {
        agent_id: existing.short_id,
        owner_pubkey: existing.owner_pubkey ?? null,
      },
    });
  }

  // 3) Verify ownership: wallet signature, OR demo bypass.
  let viaDemo = false;
  if (demo === true) {
    viaDemo = true;
  } else {
    if (!signature) {
      return apiError({
        error: "signature_required",
        code: "signature_required",
        status: 400,
        request_id: rid,
        extra: { message: "Provide signature, or demo=true." },
      });
    }
    const message = buildClaimMessage(token, existing.short_id);
    let messageBytes: Uint8Array;
    let signatureBytes: Uint8Array;
    let pubkeyBytes: Uint8Array;
    try {
      messageBytes = new TextEncoder().encode(message);
      signatureBytes = bs58.decode(signature);
      pubkeyBytes = bs58.decode(wallet_pubkey);
    } catch (e) {
      logError({ route: ROUTE, code: "bad_encoding", request_id: rid, err: e });
      return apiError({
        error: "bad_encoding",
        code: "bad_encoding",
        status: 400,
        request_id: rid,
        extra: { message: "signature/pubkey must be valid base58" },
      });
    }
    if (pubkeyBytes.length !== 32) {
      return apiError({
        error: "bad_pubkey",
        code: "bad_pubkey",
        status: 400,
        request_id: rid,
        extra: { message: "wallet_pubkey must decode to 32 bytes" },
      });
    }

    const ok = nacl.sign.detached.verify(messageBytes, signatureBytes, pubkeyBytes);
    if (!ok) {
      return apiError({
        error: "signature_rejected",
        code: "signature_rejected",
        status: 401,
        request_id: rid,
        extra: { message: `expected signed payload "${message}"` },
      });
    }
  }

  // 4) Bind owner_pubkey + mark claimed.
  const now = new Date().toISOString();
  const { data: updated, error: updErr } = await db
    .from("agents")
    .update({
      claimed: true,
      owner_pubkey: wallet_pubkey,
      claimed_at: now,
    })
    .eq("short_id", id)
    .select("short_id, owner_pubkey, claimed_at")
    .maybeSingle();

  if (updErr || !updated) {
    logError({ route: ROUTE, code: "claim_failed", request_id: rid, err: updErr });
    return apiError({
      error: "claim_failed",
      code: "claim_failed",
      status: 500,
      request_id: rid,
    });
  }

  return Response.json({
    ok: true,
    agent_id: updated.short_id,
    owner_pubkey: updated.owner_pubkey,
    claimed_at: updated.claimed_at,
    via: viaDemo ? "demo" : "signature",
  });
}
