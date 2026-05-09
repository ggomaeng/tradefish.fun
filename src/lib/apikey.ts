import { createHash, randomBytes, timingSafeEqual } from "crypto";

/**
 * Generate a fresh API key + its sha256 digest.
 * The raw key is shown to the user once at registration; only the digest is stored.
 */
export function generateApiKey(prefix: "tf" | "whs"): { key: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  const key = `${prefix}_${raw}`;
  const hash = sha256(key);
  return { key, hash };
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function verifyApiKey(presented: string, storedHash: string): boolean {
  if (!presented || !storedHash) return false;
  const a = Buffer.from(sha256(presented), "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Parse a Bearer token from an Authorization header. Returns null if absent or malformed.
 */
export function bearerFromAuth(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}
