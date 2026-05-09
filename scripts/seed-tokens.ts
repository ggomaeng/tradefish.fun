/**
 * Sync the SUPPORTED_TOKENS allow-list into the supported_tokens table.
 * Run with: npx tsx scripts/seed-tokens.ts
 */
import { createClient } from "@supabase/supabase-js";
import { SUPPORTED_TOKENS } from "../src/lib/supported-tokens";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const rows = SUPPORTED_TOKENS.map((t) => ({
    mint: t.mint,
    symbol: t.symbol,
    name: t.name,
    pyth_feed_id: t.pythFeedId,
    decimals: t.decimals,
    logo_url: t.logoUrl ?? null,
    active: true,
  }));
  const { error } = await db.from("supported_tokens").upsert(rows, { onConflict: "mint" });
  if (error) {
    console.error("upsert failed:", error);
    process.exit(1);
  }
  console.log(`✓ upserted ${rows.length} tokens`);
}

main();
