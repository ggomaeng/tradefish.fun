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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "validation_failed", issues: parsed.error.issues },
      { status: 400 },
    );
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
    console.error("[claim] lookup failed:", lookupErr);
    return Response.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (!existing) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  // 2) Reject if already claimed (idempotency: caller can re-poll GET /api/agents/<id>).
  if (existing.claimed) {
    return Response.json(
      {
        error: "already_claimed",
        agent_id: existing.short_id,
        owner_pubkey: existing.owner_pubkey ?? null,
      },
      { status: 409 },
    );
  }

  // 3) Verify ownership: wallet signature, OR demo bypass.
  let viaDemo = false;
  if (demo === true) {
    viaDemo = true;
  } else {
    if (!signature) {
      return Response.json(
        { error: "signature_required", message: "Provide signature, or demo=true." },
        { status: 400 },
      );
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
      console.error("[claim] decode error:", e);
      return Response.json(
        { error: "bad_encoding", message: "signature/pubkey must be valid base58" },
        { status: 400 },
      );
    }
    if (pubkeyBytes.length !== 32) {
      return Response.json(
        { error: "bad_pubkey", message: "wallet_pubkey must decode to 32 bytes" },
        { status: 400 },
      );
    }

    const ok = nacl.sign.detached.verify(messageBytes, signatureBytes, pubkeyBytes);
    if (!ok) {
      return Response.json(
        { error: "signature_rejected", message: `expected signed payload "${message}"` },
        { status: 401 },
      );
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
    console.error("[claim] update failed:", updErr);
    return Response.json({ error: "claim_failed" }, { status: 500 });
  }

  return Response.json({
    ok: true,
    agent_id: updated.short_id,
    owner_pubkey: updated.owner_pubkey,
    claimed_at: updated.claimed_at,
    via: viaDemo ? "demo" : "signature",
  });
}
