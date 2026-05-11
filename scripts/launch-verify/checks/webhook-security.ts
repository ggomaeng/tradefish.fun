// webhook-security — (a) confirms agents.webhook_secret_encrypted column exists
// against linked Supabase, (b) HMAC roundtrip self-test using
// WEBHOOK_MASTER_KEY from local env, falling back to the 0600 backup at
// ~/Documents/tradefish-webhook-master-key.txt (per RUNBOOK §4) so the
// verify can run on the operator's machine without re-pulling Vercel envs.
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Check } from "../types";

const KEY_BACKUP = join(homedir(), "Documents/tradefish-webhook-master-key.txt");

function loadKey(): { key: string; source: string } | { key: null; reason: string } {
  if (process.env.WEBHOOK_MASTER_KEY) {
    return { key: process.env.WEBHOOK_MASTER_KEY, source: "env" };
  }
  if (existsSync(KEY_BACKUP)) {
    try {
      const raw = readFileSync(KEY_BACKUP, "utf8").trim();
      if (raw.length > 0) {
        // Inject into process.env so webhook-crypto.ts (which reads env at
        // call time) can pick it up. Do NOT log the value.
        process.env.WEBHOOK_MASTER_KEY = raw;
        return { key: raw, source: "backup-file" };
      }
    } catch (err) {
      return { key: null, reason: `backup file read failed: ${(err as Error).message}` };
    }
  }
  return {
    key: null,
    reason:
      "WEBHOOK_MASTER_KEY not in env and ~/Documents/tradefish-webhook-master-key.txt missing",
  };
}

export const webhookSecurity: Check = {
  name: "webhook-security",
  run: async (ctx) => {
    // (b) HMAC roundtrip — purely local; works under --skip-network too.
    const loaded = loadKey();
    if (!("source" in loaded)) {
      return { status: "fail", detail: loaded.reason };
    }
    let roundtripOk = false;
    try {
      const { encryptWebhookSecret, decryptWebhookSecret } = await import(
        "../../../src/lib/webhook-crypto"
      );
      const plaintext = "wsk_known-plaintext-1234567890";
      const blob = encryptWebhookSecret(plaintext);
      const decrypted = decryptWebhookSecret(blob);
      roundtripOk = decrypted === plaintext;
    } catch (err) {
      return {
        status: "fail",
        detail: `HMAC roundtrip threw: ${(err as Error).message}`,
      };
    }
    if (!roundtripOk) {
      return { status: "fail", detail: "encrypt/decrypt roundtrip mismatch" };
    }

    // (a) Column existence check (network).
    if (ctx.skipNetwork) {
      return {
        status: "warn",
        detail: "HMAC roundtrip OK; skipped column check (--skip-network)",
      };
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !srk) {
      return {
        status: "fail",
        detail:
          "HMAC roundtrip OK but missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (cannot probe column)",
      };
    }
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(url, srk, { auth: { persistSession: false } });
    const { error } = await db
      .from("agents")
      .select("webhook_secret_encrypted", { head: true, count: "exact" })
      .limit(0);
    if (error) {
      return {
        status: "fail",
        detail: `agents.webhook_secret_encrypted column probe failed: ${error.message}`,
      };
    }
    return {
      status: "pass",
      detail: `AES-GCM roundtrip OK (key src=${loaded.source}) + agents.webhook_secret_encrypted column present`,
    };
  },
};
