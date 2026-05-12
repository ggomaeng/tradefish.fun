/**
 * Insert a demo round (is_demo=true, credits_spent=0, asker_id=null) and
 * fan it out to webhook-mode agents the same way /api/queries does.
 *
 * Caller is responsible for auth-gating its route handler. This module is
 * just the DB + dispatch mechanic.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { shortId } from "@/lib/utils";

const QUERY_DEADLINE_MS = 60 * 1000;

export interface InsertedDemoQuery {
  query_id: string;        // short_id
  internal_id: string;     // uuid
  asked_at: string;
  deadline_at: string;
}

export async function insertDemoQuery(
  db: SupabaseClient,
  args: {
    token_mint: string;
    pyth_price: number;
  },
): Promise<{ ok: true; query: InsertedDemoQuery } | { ok: false; error: string }> {
  const now = new Date();
  const deadline = new Date(now.getTime() + QUERY_DEADLINE_MS);

  const { data, error } = await db
    .from("queries")
    .insert({
      short_id: shortId("qry", 10),
      asker_id: null,
      token_mint: args.token_mint,
      question_type: "buy_sell_now",
      asked_at: now.toISOString(),
      deadline_at: deadline.toISOString(),
      pyth_price_at_ask: args.pyth_price,
      credits_spent: 0,
      is_demo: true,
    })
    .select("id, short_id, asked_at, deadline_at")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "insert_failed" };
  }

  return {
    ok: true,
    query: {
      query_id: data.short_id,
      internal_id: data.id,
      asked_at: data.asked_at,
      deadline_at: data.deadline_at,
    },
  };
}

/**
 * Fire-and-forget webhook fan-out. Mirrors the helper in /api/queries.
 * Never throws to the caller.
 */
export async function dispatchToWebhookAgents(args: {
  query_id: string;
  mint: string;
  symbol: string;
  deadline_at: string;
}): Promise<void> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    await fetch(`${base}/api/internal/dispatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.INTERNAL_WEBHOOK_HMAC_SECRET ?? ""}`,
      },
      body: JSON.stringify({
        query_id: args.query_id,
        mint: args.mint,
        symbol: args.symbol,
        deadline_at: args.deadline_at,
      }),
    });
  } catch (err) {
    console.error("[demo-cron] dispatch trigger failed:", err);
  }
}

/**
 * Is there already an open demo round on this token? An "open" round is one
 * whose deadline hasn't passed.
 */
export async function hasOpenDemoRound(
  db: SupabaseClient,
  token_mint: string,
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const { data } = await db
    .from("queries")
    .select("id")
    .eq("is_demo", true)
    .eq("token_mint", token_mint)
    .gt("deadline_at", nowIso)
    .limit(1);
  return (data?.length ?? 0) > 0;
}
