import { type NextRequest } from "next/server";
import { z } from "zod";
import { dbAdmin } from "@/lib/db";

const Schema = z.object({
  email: z.string().email().max(254),
  source: z.string().max(40).optional(),
  utm: z
    .object({
      source: z.string().max(64).optional(),
      medium: z.string().max(64).optional(),
      campaign: z.string().max(64).optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_failed" }, { status: 400 });
  }

  const { email, source, utm } = parsed.data;
  const normalized = email.trim().toLowerCase();

  let db;
  try {
    db = dbAdmin();
  } catch {
    // DB not configured locally — accept gracefully so dev demos don't break.
    if (process.env.NODE_ENV !== "production") {
      console.log("[waitlist] (dev, no db)", normalized);
      return Response.json({ ok: true, dev: true }, { status: 201 });
    }
    return Response.json({ error: "service_unavailable" }, { status: 503 });
  }

  const { error } = await db.from("waitlist_signups").insert({
    email: normalized,
    source: source ?? "landing",
    referrer: request.headers.get("referer"),
    user_agent: request.headers.get("user-agent"),
    utm_source: utm?.source ?? null,
    utm_medium: utm?.medium ?? null,
    utm_campaign: utm?.campaign ?? null,
  });

  if (error) {
    // Postgres unique-violation = already on the list. Treat as success.
    if ((error as any).code === "23505") {
      return Response.json({ ok: true, already: true }, { status: 200 });
    }
    console.error("[waitlist] insert failed:", error);
    return Response.json({ error: "insert_failed" }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 201 });
}
