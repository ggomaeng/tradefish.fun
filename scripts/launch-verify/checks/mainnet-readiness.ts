// mainnet-readiness — RPC ping, treasury balance, Pyth feed sample.
import type { Check } from "../types";

const MAINNET_RPC = "https://api.mainnet-beta.solana.com";
const MAINNET_TREASURY = "CFgBLpStEPRZf2pHiUbccB731avjvUb7a9yBApu3jR7Y";
// SOL/USD mainnet feed id (matches src/lib/supported-tokens.ts entry).
const SOL_USD_FEED = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const HERMES_BASE = "https://hermes.pyth.network";

async function rpcCall<T>(method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(MAINNET_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return json.result as T;
}

export const mainnetReadiness: Check = {
  name: "mainnet-readiness",
  run: async (ctx) => {
    if (ctx.skipNetwork) {
      return { status: "warn", detail: "skipped (--skip-network)" };
    }
    // (a) RPC ping
    let slot: number;
    try {
      slot = await rpcCall<number>("getSlot");
      if (typeof slot !== "number") throw new Error(`unexpected slot type: ${typeof slot}`);
    } catch (err) {
      return { status: "fail", detail: `RPC ping failed: ${(err as Error).message}` };
    }

    // (b) Treasury balance — 0 is a warn (unfunded), not fail.
    let lamports: number;
    try {
      const result = await rpcCall<{ value: number }>("getBalance", [MAINNET_TREASURY]);
      lamports = result.value;
    } catch (err) {
      return { status: "fail", detail: `treasury balance fetch failed: ${(err as Error).message}` };
    }

    // (c) Pyth feed sample
    let pythPrice: string;
    try {
      const url = `${HERMES_BASE}/v2/updates/price/latest?ids[]=${SOL_USD_FEED}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Hermes HTTP ${res.status}`);
      const body = (await res.json()) as {
        parsed?: Array<{ price?: { price?: string; expo?: number } }>;
      };
      const p = body.parsed?.[0]?.price;
      if (!p || typeof p.price !== "string" || typeof p.expo !== "number") {
        throw new Error("unexpected Hermes response shape");
      }
      pythPrice = p.price;
    } catch (err) {
      return { status: "fail", detail: `Pyth feed sample failed: ${(err as Error).message}` };
    }

    const sol = (lamports / 1e9).toFixed(4);
    const baseDetail = `slot=${slot} treasury=${sol} SOL pyth_sol_raw=${pythPrice}`;
    if (lamports === 0) {
      return {
        status: "warn",
        detail: `${baseDetail} (treasury unfunded — USER ACTION required before mainnet ops)`,
      };
    }
    return { status: "pass", detail: baseDetail };
  },
};
