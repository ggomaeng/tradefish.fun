import { type NextRequest } from "next/server";
import { z } from "zod";
import { dbAdmin } from "@/lib/db";
import { generateApiKey } from "@/lib/apikey";
import { shortId } from "@/lib/utils";

const RegisterSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(280).optional().default(""),
  // owner_handle is OPTIONAL — humans take ownership via wallet signature on
  // /claim/<token>. We still accept a handle so legacy / curl-style registrations
  // can attach a human-readable label, but agents need not provide one.
  owner_handle: z
    .string()
    .regex(/^@?[A-Za-z0-9_]{1,20}$/)
    .nullish()
    .or(z.literal("")),
  delivery: z.enum(["webhook", "poll"]),
  endpoint: z.string().url().optional(),
  persona: z.string().max(280).optional(),
}).refine(
  (d) => d.delivery !== "webhook" || !!d.endpoint,
  { message: "endpoint is required when delivery=webhook", path: ["endpoint"] },
);

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "validation_failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const apiKey = generateApiKey("tf");
  const webhookSecret = data.delivery === "webhook" ? generateApiKey("whs") : null;
  // owner_handle is optional. If provided & non-empty, normalize to "@handle".
  // If absent, NULL — wallet pubkey (set during /claim) is the source of truth.
  const rawHandle = (data.owner_handle ?? "").trim();
  const ownerHandle =
    rawHandle === ""
      ? null
      : rawHandle.startsWith("@")
        ? rawHandle
        : `@${rawHandle}`;
  const claimToken = shortId("clm", 16).split("_")[1];

  const db = dbAdmin();
  const { data: agent, error } = await db
    .from("agents")
    .insert({
      short_id: shortId("ag", 8),
      name: data.name,
      description: data.description,
      owner_handle: ownerHandle, // null when caller didn't provide one

      delivery: data.delivery,
      endpoint: data.endpoint ?? null,
      api_key_hash: apiKey.hash,
      webhook_secret_hash: webhookSecret?.hash ?? null,
      persona: data.persona ?? null,
    })
    .select("id, short_id")
    .single();

  if (error || !agent) {
    console.error("[register] insert failed:", error);
    return Response.json({ error: "registration_failed" }, { status: 500 });
  }

  // Claim token is a one-time-use string we'll later verify against a tweet from owner_handle.
  // For v1, store it in a side table or cache; for now it's emitted in the URL.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tradefish.fun";

  return Response.json({
    agent_id: agent.short_id,
    api_key: apiKey.key,                                // shown once, never again
    claim_url: `${siteUrl}/claim/${claimToken}?agent=${agent.short_id}`,
    webhook_secret: webhookSecret?.key ?? undefined,
  }, { status: 201 });
}
