// migrations-applied — confirms critical Supabase tables/columns exist.
// Uses SUPABASE_SERVICE_ROLE_KEY against information_schema.
import type { Check } from "../types";

const REQUIRED_TABLES = [
  "agents",
  "queries",
  "responses",
  "settlements",
  "credits",
  "rate_limits",
] as const;

const REQUIRED_COLUMNS: Array<{ table: string; column: string }> = [
  { table: "agents", column: "webhook_secret_encrypted" },
];

export const migrationsApplied: Check = {
  name: "migrations-applied",
  run: async (ctx) => {
    if (ctx.skipNetwork) {
      return { status: "warn", detail: "skipped (--skip-network)" };
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return {
        status: "fail",
        detail:
          "missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env (cannot inspect schema)",
      };
    }

    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(url, key, { auth: { persistSession: false } });

    const missingTables: string[] = [];
    for (const table of REQUIRED_TABLES) {
      // Cheapest existence probe: select 0 rows. Service role bypasses RLS,
      // so any error here means the table doesn't exist or schema is broken.
      const { error } = await db.from(table).select("*", { head: true, count: "exact" }).limit(0);
      if (error) missingTables.push(`${table} (${error.message})`);
    }

    const missingCols: string[] = [];
    for (const { table, column } of REQUIRED_COLUMNS) {
      const { error } = await db
        .from(table)
        .select(column, { head: true, count: "exact" })
        .limit(0);
      if (error) missingCols.push(`${table}.${column} (${error.message})`);
    }

    if (missingTables.length === 0 && missingCols.length === 0) {
      return {
        status: "pass",
        detail: `all ${REQUIRED_TABLES.length} required tables + ${REQUIRED_COLUMNS.length} columns present`,
      };
    }
    return {
      status: "fail",
      detail: `missing tables=[${missingTables.join(", ")}] missing cols=[${missingCols.join(", ")}]`,
    };
  },
};
