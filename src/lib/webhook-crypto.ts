/**
 * AES-256-GCM encryption for per-agent webhook secrets at rest.
 *
 * Storage layout (per RUNBOOK §4):
 *   [12-byte IV] || [ciphertext] || [16-byte GCM tag]
 *
 * The master key is read from `WEBHOOK_MASTER_KEY` (32-byte hex string) on
 * each call so tests and route handlers can override it via process.env
 * without module-load timing surprises. Generate with `openssl rand -hex 32`.
 *
 * Uses Node's built-in `crypto` — no extra dependencies.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

function loadMasterKey(): Buffer {
  const hex = process.env.WEBHOOK_MASTER_KEY;
  if (!hex || hex.length === 0) {
    throw new Error(
      "WEBHOOK_MASTER_KEY is not set. Generate one with `openssl rand -hex 32` and set it in the environment.",
    );
  }
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error("WEBHOOK_MASTER_KEY must be a hex string.");
  }
  if (hex.length !== KEY_BYTES * 2) {
    throw new Error(
      `WEBHOOK_MASTER_KEY must be ${KEY_BYTES * 2} hex characters (${KEY_BYTES} bytes); got ${hex.length}.`,
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a webhook secret. Returns the storage blob:
 * `Buffer.concat([iv (12), ciphertext, tag (16)])`.
 */
export function encryptWebhookSecret(plaintext: string): Buffer {
  if (typeof plaintext !== "string") {
    throw new Error("encryptWebhookSecret: plaintext must be a string.");
  }
  const key = loadMasterKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  if (tag.length !== TAG_BYTES) {
    // Defensive: Node's GCM default tag is 16 bytes; assert in case that ever changes.
    throw new Error(
      `Unexpected GCM tag length ${tag.length}; expected ${TAG_BYTES}.`,
    );
  }
  return Buffer.concat([iv, ct, tag]);
}

/**
 * Decrypt a storage blob produced by {@link encryptWebhookSecret}. Throws if
 * the blob is too short, the master key is wrong, or the GCM tag doesn't
 * verify (i.e. the ciphertext or tag has been tampered with).
 */
export function decryptWebhookSecret(blob: Buffer | Uint8Array): string {
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  if (buf.length < IV_BYTES + TAG_BYTES) {
    throw new Error(
      `Encrypted blob too short: got ${buf.length} bytes, need at least ${IV_BYTES + TAG_BYTES}.`,
    );
  }
  const key = loadMasterKey();
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(buf.length - TAG_BYTES);
  const ct = buf.subarray(IV_BYTES, buf.length - TAG_BYTES);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}
