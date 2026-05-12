"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

const LAMPORTS_PER_SOL = 1_000_000_000;

export function useSolBalance(): {
  lamports: number | null;
  sol: number | null;
  refetch: () => void;
} {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [lamports, setLamports] = useState<number | null>(null);

  const refetch = useCallback(async () => {
    if (!publicKey) {
      setLamports(null);
      return;
    }
    try {
      const v = await connection.getBalance(publicKey, "confirmed");
      setLamports(v);
    } catch {
      setLamports(null);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    function onHint() {
      void refetch();
    }
    window.addEventListener("tradefish:credits-changed", onHint);
    return () =>
      window.removeEventListener("tradefish:credits-changed", onHint);
  }, [refetch]);

  return {
    lamports,
    sol: lamports !== null ? lamports / LAMPORTS_PER_SOL : null,
    refetch,
  };
}

export function formatSol(sol: number | null): string {
  if (sol === null) return "—";
  if (sol === 0) return "0";
  if (sol < 0.0001) return sol.toFixed(6);
  if (sol < 1) return sol.toFixed(4);
  return sol.toFixed(2);
}
