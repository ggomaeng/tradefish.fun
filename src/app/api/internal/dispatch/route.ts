/**
 * Internal: dispatch a query to all webhook-mode agents.
 * Called fire-and-forget by /api/queries after a query is created.
 *
 * Each outbound webhook is HMAC-SHA256 signed with the agent's *own* webhook
 * secret. The secret is stored encrypted at rest (AES-256-GCM, RUNBOOK §4)
 * in `agents.webhook_secret_encrypted`. We decrypt per-row, sign the exact
 * serialized JSON body bytes, and set `X-TradeFish-Signature: sha256=<hex>`.
 *
 * Backward compatibility: agents that registered before
 * `webhook_secret_encrypted` was wired (column NULL) get a dispatch with NO
 * signature header and a console warning. They continue to receive the event
 * — they just can't verify authenticity until they re-register.
 */
import { type NextRequest } from "next/server";
import { createHmac } from "crypto";
import { dbAdmin } from "@/lib/db";
import { decryptWebhookSecret } from "@/lib/webhook-crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Normalize a Supabase bytea value into a Buffer. PostgREST returns bytea as
 * a hex-encoded string with a `\x` prefix (e.g. `"\\xdeadbeef"`). Some
 * client paths may surface it as a Buffer, Uint8Array, or base64 string —
 * be lenient.
 */
export function decodeBytea(value: unknown): Buffer | null {
  if (value == null) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") {
    if (value.startsWith("\\x") || value.startsWith("\\X")) {
      const hex = value.slice(2);
      if (hex.length === 0 || hex.length % 2 !== 0) return null;
      if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
      return Buffer.from(hex, "hex");
    }
    // Fallback: try base64. Supabase rarely emits this for bytea, but be safe.
    try {
      return Buffer.from(value, "base64");
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Sign a payload string with HMAC-SHA256. Exposed for tests.
 */
export function signPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

interface DispatchAgentRow {
  id: string;
  endpoint: string | null;
  webhook_secret_encrypted: unknown;
}

export async function POST(request: NextRequest) {
  // Internal-only — gate by shared secret
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.INTERNAL_WEBHOOK_HMAC_SECRET ?? ""}`;
  if (!process.env.INTERNAL_WEBHOOK_HMAC_SECRET || auth !== expected) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.query_id || !body?.mint || !body?.symbol || !body?.deadline_at) {
    return Response.json({ error: "bad_payload" }, { status: 400 });
  }

  const db = dbAdmin();
  const { data: agentsRaw } = await db
    .from("agents")
    .select("id, endpoint, webhook_secret_encrypted")
    .eq("delivery", "webhook")
    .not("endpoint", "is", null);

  const agents = (agentsRaw ?? []) as DispatchAgentRow[];

  if (agents.length === 0) {
    return Response.json({ ok: true, dispatched: 0 });
  }

  // IMPORTANT: serialize the JSON exactly once and use those exact bytes both
  // for the HMAC input and the request body. Re-serializing per-agent would
  // be functionally equivalent but defeats the "exact bytes signed = exact
  // bytes received" contract that downstream verifiers rely on.
  const payload = JSON.stringify({
    query_id: body.query_id,
    token: { mint: body.mint, symbol: body.symbol },
    question: "buy_sell_now",
    deadline_at: body.deadline_at,
  });

  const results = await Promise.allSettled(
    agents.map((agent) => dispatchOne(agent, payload)),
  );

  const ok = results.filter((r) => r.status === "fulfilled" && r.value).length;
  const failed = results.length - ok;
  return Response.json({ ok: true, dispatched: ok, failed });
}

/**
 * Send one webhook. Resolves with `true` on a fulfilled fetch (HTTP status
 * doesn't matter — the agent acknowledges asynchronously via /respond).
 * Throws on transport failure so Promise.allSettled records it as rejected.
 */
async function dispatchOne(
  agent: DispatchAgentRow,
  payload: string,
): Promise<boolean> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-TradeFish-Event": "query.created",
  };

  const blob = decodeBytea(agent.webhook_secret_encrypted);
  if (blob) {
    try {
      const secret = decryptWebhookSecret(blob);
      headers["X-TradeFish-Signature"] = `sha256=${signPayload(secret, payload)}`;
    } catch (err) {
      // Decryption failure is recoverable (skip signature, log); we should NOT
      // drop the dispatch because of a key/blob mismatch — that would silently
      // strand the agent.
      console.warn(
        "[dispatch] decrypt failed for agent",
        agent.id,
        err instanceof Error ? err.message : err,
      );
    }
  } else {
    console.warn(
      "[dispatch] agent",
      agent.id,
      "has no webhook_secret_encrypted; sending unsigned (legacy)",
    );
  }

  await fetch(agent.endpoint!, {
    method: "POST",
    headers,
    body: payload,
    signal: AbortSignal.timeout(5000),
  });
  return true;
}
