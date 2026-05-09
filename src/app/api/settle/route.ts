/**
 * Vercel Cron: settle responses whose 1h / 4h / 24h windows have elapsed.
 *
 * Cron config (vercel.json):
 *   { "path": "/api/settle", "schedule": "*\/5 * * * *" }   // every 5 min
 *
 * Auth: Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically when configured.
 * We accept either Vercel's header or our own SETTLEMENT_CRON_SECRET.
 */
import { type NextRequest } from "next/server";
import { dbAdmin } from "@/lib/db";
import { getPythPrices } from "@/lib/clients/pyth";
import { computeSettlement, WINDOWS, WINDOW_MS, type Window, type Answer } from "@/lib/settlement";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.SETTLEMENT_CRON_SECRET ?? ""}`;
  if (!process.env.SETTLEMENT_CRON_SECRET || auth !== expected) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = dbAdmin();
  const now = Date.now();
  const summary: Record<Window, number> = { "1h": 0, "4h": 0, "24h": 0 };

  for (const window of WINDOWS) {
    const cutoffIso = new Date(now - WINDOW_MS[window]).toISOString();

    // Find responses that crossed this window's elapsed threshold and aren't yet settled.
    const { data: due, error } = await db
      .from("responses")
      .select(`
        id,
        answer,
        confidence,
        pyth_price_at_response,
        responded_at,
        query_id,
        queries!inner(token_mint, supported_tokens!inner(pyth_feed_id))
      `)
      .lte("responded_at", cutoffIso)
      .limit(200);

    if (error) {
      console.error(`[settle:${window}] fetch failed:`, error);
      continue;
    }
    if (!due || due.length === 0) continue;

    // Filter out already-settled (response_id, window) pairs
    const ids = due.map((d: any) => d.id);
    const { data: existing } = await db
      .from("settlements")
      .select("response_id")
      .in("response_id", ids)
      .eq("window", window);
    const settledSet = new Set((existing ?? []).map((s) => s.response_id));
    const toSettle = due.filter((d: any) => !settledSet.has(d.id));
    if (toSettle.length === 0) continue;

    // Batch-fetch current Pyth prices for all unique feeds
    const feedIds = Array.from(new Set(toSettle.map((d: any) => d.queries.supported_tokens.pyth_feed_id)));
    const prices = await getPythPrices(feedIds);

    const rows = [];
    for (const d of toSettle as any[]) {
      const feedId = d.queries.supported_tokens.pyth_feed_id;
      const exitPrice = prices[feedId.startsWith("0x") ? feedId : `0x${feedId}`];
      if (exitPrice === undefined) continue;

      const result = computeSettlement({
        answer: d.answer as Answer,
        confidence: Number(d.confidence),
        priceAtResponse: Number(d.pyth_price_at_response),
        priceAtSettle: exitPrice,
        window,
      });

      rows.push({
        response_id: d.id,
        window,
        pnl_pct: result.pnlPct,
        pyth_price_at_settle: exitPrice,
        direction_correct: result.directionCorrect,
      });
    }

    if (rows.length > 0) {
      const { error: insErr } = await db.from("settlements").insert(rows);
      if (insErr) {
        console.error(`[settle:${window}] insert failed:`, insErr);
      } else {
        summary[window] = rows.length;
      }
    }
  }

  return Response.json({ ok: true, settled: summary, ran_at: new Date().toISOString() });
}
