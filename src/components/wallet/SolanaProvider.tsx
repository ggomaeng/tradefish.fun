"use client";

/**
 * SolanaProvider — wraps the post-waitlist app in the wallet-adapter context
 * so any client component under (platform)/* can call useWallet() / useConnection().
 *
 * - ConnectionProvider points at NEXT_PUBLIC_SOLANA_RPC (devnet for the demo).
 * - WalletProvider registers Phantom + Solflare, autoConnects when previously approved.
 * - WalletModalProvider renders the wallet-picker portal.
 *
 * SSR pitfalls handled:
 *   1. The whole tree is "use client" so no wallet-adapter code runs server-side.
 *   2. Wallet adapter constructors are wrapped in useMemo() to avoid re-instantiating
 *      on every render (and to keep them out of the SSR pass entirely).
 *   3. The default wallet-adapter-react-ui CSS is imported once here. It's scoped
 *      to .wallet-adapter-* classes so it doesn't leak into the brand surface.
 */

import { useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import type { Adapter } from "@solana/wallet-adapter-base";

import "@solana/wallet-adapter-react-ui/styles.css";

const DEFAULT_RPC = "https://api.devnet.solana.com";

export function SolanaProvider({ children }: { children: ReactNode }) {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC || DEFAULT_RPC;

  const wallets = useMemo<Adapter[]>(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
