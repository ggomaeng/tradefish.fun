import { type NextRequest } from "next/server";
import { z } from "zod";
import { dbAdmin } from "@/lib/db";
import { generateApiKey } from "@/lib/apikey";
import { shortId } from "@/lib/utils";
import { enforce, rateLimitedResponse, subjectFromRequest } from "@/lib/rate-limit";
import { encryptWebhookSecret } from "@/lib/webhook-crypto";
import { apiError, logError, requestId } from "@/lib/api-error";

const ROUTE = "/api/agents/register";

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
  const rid = requestId(request);

  // Rate limit by IP — registration is unauthenticated (RUNBOOK §3, 10 RPM).
  const rl = await enforce({
    subject: subjectFromRequest(request, null),
    route: ROUTE,
    window_seconds: 60,
    max_count: 10,
  });
  if (!rl.ok) return rateLimitedResponse(rl);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError({
      error: "invalid_json",
      code: "invalid_json",
      status: 400,
      request_id: rid,
    });
  }

  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return apiError({
      error: "validation_failed",
      code: "validation_failed",
      status: 400,
      request_id: rid,
      extra: { issues: parsed.error.issues },
    });
  }

  const data = parsed.data;
  const apiKey = generateApiKey("tf");
  const webhookSecret = data.delivery === "webhook" ? generateApiKey("whs") : null;

  // Encrypt the webhook secret at rest (RUNBOOK §4) so /api/internal/dispatch
  // can decrypt it and HMAC-sign per-agent payloads. The hash column is kept
  // for backward compatibility — older code paths that only know the hash
  // continue to work. If WEBHOOK_MASTER_KEY isn't set, fall back to the
  // hash-only path so registration doesn't hard-fail in misconfigured envs;
  // the dispatch path will then skip per-agent signing for this agent.
  let webhookSecretEncryptedHex: string | null = null;
  if (webhookSecret) {
    try {
      const blob = encryptWebhookSecret(webhookSecret.key);
      // Supabase JS sends bytea as a hex-prefixed string (`\xDEADBEEF`).
      webhookSecretEncryptedHex = `\\x${blob.toString("hex")}`;
    } catch (err) {
      console.warn(
        "[register] webhook secret encryption skipped:",
        err instanceof Error ? err.message : err,
      );
    }
  }
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
      webhook_secret_encrypted: webhookSecretEncryptedHex,
      persona: data.persona ?? null,
    })
    .select("id, short_id")
    .single();

  if (error || !agent) {
    logError({ route: ROUTE, code: "registration_failed", request_id: rid, err: error });
    return apiError({
      error: "registration_failed",
      code: "registration_failed",
      status: 500,
      request_id: rid,
    });
  }

  // The claim_url is the surface where the human owner takes ownership. They
  // visit it with their Solana wallet and sign the canonical message
  // `tradefish:claim:<token>:<short_id>` — the verified pubkey is then bound
  // to the agent as owner_pubkey (see /api/agents/[id]/claim).
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tradefish.fun";

  return Response.json({
    agent_id: agent.short_id,
    api_key: apiKey.key,                                // shown once, never again
    claim_url: `${siteUrl}/claim/${claimToken}?agent=${agent.short_id}`,
    webhook_secret: webhookSecret?.key ?? undefined,
  }, { status: 201 });
}
