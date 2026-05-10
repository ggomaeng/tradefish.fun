import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  explorerClusterQuery,
  getRpcUrl,
  getSolanaNetwork,
  getTreasuryPubkey,
} from "./solana-config";

const ENV_KEYS = [
  "NEXT_PUBLIC_SOLANA_NETWORK",
  "NEXT_PUBLIC_SOLANA_RPC",
  "NEXT_PUBLIC_TRADEFISH_TREASURY",
] as const;

const DEVNET_TREASURY = "GigzG9cDT2kamQRtkt6Njm4hXr2EFGRsL1NAGQ7RagSk";
const MAINNET_TREASURY = "CFgBLpStEPRZf2pHiUbccB731avjvUb7a9yBApu3jR7Y";
const DEVNET_RPC = "https://api.devnet.solana.com";
const MAINNET_RPC = "https://api.mainnet-beta.solana.com";

describe("solana-config", () => {
  // Snapshot/restore env between tests so they don't leak across the suite.
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("defaults to devnet when no env is set (safe default)", () => {
    expect(getSolanaNetwork()).toBe("devnet");
    expect(getRpcUrl()).toBe(DEVNET_RPC);
    expect(getTreasuryPubkey()).toBe(DEVNET_TREASURY);
    expect(explorerClusterQuery()).toBe("?cluster=devnet");
  });

  it("treats empty NEXT_PUBLIC_SOLANA_NETWORK as unset (defaults to devnet)", () => {
    process.env.NEXT_PUBLIC_SOLANA_NETWORK = "";
    expect(getSolanaNetwork()).toBe("devnet");
  });

  it("routes to mainnet-beta when NEXT_PUBLIC_SOLANA_NETWORK='mainnet-beta'", () => {
    process.env.NEXT_PUBLIC_SOLANA_NETWORK = "mainnet-beta";
    expect(getSolanaNetwork()).toBe("mainnet-beta");
    expect(getRpcUrl()).toBe(MAINNET_RPC);
    expect(getTreasuryPubkey()).toBe(MAINNET_TREASURY);
    expect(explorerClusterQuery()).toBe("");
  });

  it("explicit NEXT_PUBLIC_SOLANA_RPC overrides per-network default", () => {
    process.env.NEXT_PUBLIC_SOLANA_RPC = "https://custom-rpc.example.com";
    // Defaults to devnet network but uses custom RPC.
    expect(getRpcUrl()).toBe("https://custom-rpc.example.com");

    process.env.NEXT_PUBLIC_SOLANA_NETWORK = "mainnet-beta";
    expect(getRpcUrl()).toBe("https://custom-rpc.example.com");
  });

  it("explicit NEXT_PUBLIC_TRADEFISH_TREASURY overrides per-network default", () => {
    process.env.NEXT_PUBLIC_TRADEFISH_TREASURY = "OverrideTreasuryPubkey1111111111111111111111";
    expect(getTreasuryPubkey()).toBe("OverrideTreasuryPubkey1111111111111111111111");

    process.env.NEXT_PUBLIC_SOLANA_NETWORK = "mainnet-beta";
    expect(getTreasuryPubkey()).toBe("OverrideTreasuryPubkey1111111111111111111111");
  });

  it("throws on unrecognized NEXT_PUBLIC_SOLANA_NETWORK", () => {
    process.env.NEXT_PUBLIC_SOLANA_NETWORK = "testnet";
    expect(() => getSolanaNetwork()).toThrow(/Unrecognized/);
    expect(() => getRpcUrl()).toThrow(/Unrecognized/);
    expect(() => getTreasuryPubkey()).toThrow(/Unrecognized/);
  });

  it("reads env at call time (not module-load time)", () => {
    expect(getSolanaNetwork()).toBe("devnet");
    process.env.NEXT_PUBLIC_SOLANA_NETWORK = "mainnet-beta";
    expect(getSolanaNetwork()).toBe("mainnet-beta");
    delete process.env.NEXT_PUBLIC_SOLANA_NETWORK;
    expect(getSolanaNetwork()).toBe("devnet");
  });
});
