/**
 * solana-config — single source of truth for Solana network selection.
 *
 * - `NEXT_PUBLIC_SOLANA_NETWORK` selects the cluster: 'devnet' | 'mainnet-beta'.
 *   Defaults to 'devnet' (safe default — never silently route to mainnet).
 * - `NEXT_PUBLIC_SOLANA_RPC` overrides the RPC URL when set; otherwise the
 *   public default for the active network is used.
 * - `NEXT_PUBLIC_TRADEFISH_TREASURY` overrides the treasury pubkey when set;
 *   otherwise the per-network default from RUNBOOK §1 is used.
 *
 * All getters read `process.env` at call time (NOT at module load) so tests
 * and server-side route handlers can mutate env without import-order issues.
 */

export type SolanaNetwork = "devnet" | "mainnet-beta";

const DEFAULT_RPC: Record<SolanaNetwork, string> = {
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};

// RUNBOOK §1 — treasury pubkeys per network.
const DEFAULT_TREASURY: Record<SolanaNetwork, string> = {
  devnet: "GigzG9cDT2kamQRtkt6Njm4hXr2EFGRsL1NAGQ7RagSk",
  "mainnet-beta": "CFgBLpStEPRZf2pHiUbccB731avjvUb7a9yBApu3jR7Y",
};

export function getSolanaNetwork(): SolanaNetwork {
  const raw = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
  if (!raw || raw.length === 0) return "devnet";
  if (raw === "devnet" || raw === "mainnet-beta") return raw;
  throw new Error(
    `Unrecognized NEXT_PUBLIC_SOLANA_NETWORK="${raw}" — must be 'devnet' or 'mainnet-beta'.`,
  );
}

export function getRpcUrl(): string {
  const override = process.env.NEXT_PUBLIC_SOLANA_RPC;
  if (override && override.length > 0) return override;
  return DEFAULT_RPC[getSolanaNetwork()];
}

export function getTreasuryPubkey(): string {
  const override = process.env.NEXT_PUBLIC_TRADEFISH_TREASURY;
  if (override && override.length > 0) return override;
  return DEFAULT_TREASURY[getSolanaNetwork()];
}

/**
 * Returns the cluster query string suitable for explorer URLs.
 * mainnet-beta -> "" (no cluster query); devnet -> "?cluster=devnet".
 */
export function explorerClusterQuery(): string {
  return getSolanaNetwork() === "mainnet-beta" ? "" : "?cluster=devnet";
}
