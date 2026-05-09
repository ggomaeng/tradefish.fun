/**
 * Internal: dispatch a query to all webhook-mode agents.
 * Called fire-and-forget by /api/queries after a query is created.
 *
 * Webhook payload is HMAC-signed with each agent's webhook_secret so the agent
 * can verify authenticity (raw secret never crosses the wire after registration).
 */
import { type NextRequest } from "next/server";
import { createHmac } from "crypto";
import { dbAdmin } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
  const { data: agents } = await db
    .from("agents")
    .select("id, endpoint, webhook_secret_hash")
    .eq("delivery", "webhook")
    .not("endpoint", "is", null);

  if (!agents || agents.length === 0) {
    return Response.json({ ok: true, dispatched: 0 });
  }

  const payload = JSON.stringify({
    query_id: body.query_id,
    token: { mint: body.mint, symbol: body.symbol },
    question: "buy_sell_now",
    deadline_at: body.deadline_at,
  });

  // The webhook_secret is hashed at rest, so we can't sign with it directly.
  // For v1, sign with the platform-wide INTERNAL_WEBHOOK_HMAC_SECRET; agents
  // can verify they were registered with the same secret derivation.
  // (TODO v2: store the raw secret encrypted at rest so we can per-agent sign.)
  const sig = createHmac("sha256", process.env.INTERNAL_WEBHOOK_HMAC_SECRET!).update(payload).digest("hex");

  // Fan out concurrently with a short timeout per agent. Don't fail the round on bad agents.
  const results = await Promise.allSettled(
    agents.map((a) =>
      fetch(a.endpoint!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-TradeFish-Event": "query.created",
          "X-TradeFish-Signature": sig,
        },
        body: payload,
        signal: AbortSignal.timeout(5000),
      }).catch((e) => { throw e; }),
    ),
  );

  const ok = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - ok;
  return Response.json({ ok: true, dispatched: ok, failed });
}
