import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

import {
  decryptWebhookSecret,
  encryptWebhookSecret,
} from "./webhook-crypto";

const TEST_KEY_HEX = randomBytes(32).toString("hex");
let savedKey: string | undefined;

beforeAll(() => {
  savedKey = process.env.WEBHOOK_MASTER_KEY;
  process.env.WEBHOOK_MASTER_KEY = TEST_KEY_HEX;
});

afterAll(() => {
  if (savedKey === undefined) {
    delete process.env.WEBHOOK_MASTER_KEY;
  } else {
    process.env.WEBHOOK_MASTER_KEY = savedKey;
  }
});

describe("webhook-crypto", () => {
  it("roundtrips arbitrary UTF-8 plaintext", () => {
    const plaintext = "whk_secret_" + randomBytes(16).toString("hex");
    const blob = encryptWebhookSecret(plaintext);
    expect(blob).toBeInstanceOf(Buffer);
    // 12 IV + ciphertext + 16 tag; ciphertext for AES-GCM matches plaintext length
    expect(blob.length).toBe(12 + Buffer.byteLength(plaintext, "utf8") + 16);
    expect(decryptWebhookSecret(blob)).toBe(plaintext);
  });

  it("roundtrips multibyte unicode", () => {
    const plaintext = "🐟 trade-fish 安全 secret";
    const blob = encryptWebhookSecret(plaintext);
    expect(decryptWebhookSecret(blob)).toBe(plaintext);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const plaintext = "same-input-every-time";
    const a = encryptWebhookSecret(plaintext);
    const b = encryptWebhookSecret(plaintext);
    expect(a.equals(b)).toBe(false);
    // IVs differ
    expect(a.subarray(0, 12).equals(b.subarray(0, 12))).toBe(false);
    // both still decrypt to the original
    expect(decryptWebhookSecret(a)).toBe(plaintext);
    expect(decryptWebhookSecret(b)).toBe(plaintext);
  });

  it("throws when any byte in the blob is tampered with", () => {
    const plaintext = "tamper-me";
    const blob = encryptWebhookSecret(plaintext);
    // Tamper at multiple positions: inside IV, inside ciphertext, inside tag.
    const positions = [
      0, // IV
      Math.floor(blob.length / 2), // ciphertext
      blob.length - 1, // tag
    ];
    for (const pos of positions) {
      const tampered = Buffer.from(blob);
      tampered[pos] = tampered[pos] ^ 0xff;
      expect(() => decryptWebhookSecret(tampered)).toThrow();
    }
  });

  it("throws when the blob is shorter than the minimum frame", () => {
    expect(() => decryptWebhookSecret(Buffer.alloc(10))).toThrow(
      /too short/i,
    );
  });

  it("throws when WEBHOOK_MASTER_KEY is missing", () => {
    const prev = process.env.WEBHOOK_MASTER_KEY;
    delete process.env.WEBHOOK_MASTER_KEY;
    try {
      expect(() => encryptWebhookSecret("x")).toThrow(/WEBHOOK_MASTER_KEY/);
      expect(() => decryptWebhookSecret(Buffer.alloc(40))).toThrow(
        /WEBHOOK_MASTER_KEY/,
      );
    } finally {
      process.env.WEBHOOK_MASTER_KEY = prev;
    }
  });

  it("throws when WEBHOOK_MASTER_KEY is the wrong length", () => {
    const prev = process.env.WEBHOOK_MASTER_KEY;
    process.env.WEBHOOK_MASTER_KEY = "deadbeef"; // 8 hex chars = 4 bytes
    try {
      expect(() => encryptWebhookSecret("x")).toThrow(/64 hex characters/);
    } finally {
      process.env.WEBHOOK_MASTER_KEY = prev;
    }
  });

  it("throws when WEBHOOK_MASTER_KEY is not hex", () => {
    const prev = process.env.WEBHOOK_MASTER_KEY;
    process.env.WEBHOOK_MASTER_KEY = "z".repeat(64);
    try {
      expect(() => encryptWebhookSecret("x")).toThrow(/hex/i);
    } finally {
      process.env.WEBHOOK_MASTER_KEY = prev;
    }
  });

  it("decrypts with a different but valid key fails (auth tag mismatch)", () => {
    const plaintext = "needs-correct-key";
    const blob = encryptWebhookSecret(plaintext);
    const prev = process.env.WEBHOOK_MASTER_KEY;
    process.env.WEBHOOK_MASTER_KEY = randomBytes(32).toString("hex");
    try {
      expect(() => decryptWebhookSecret(blob)).toThrow();
    } finally {
      process.env.WEBHOOK_MASTER_KEY = prev;
    }
  });
});
