import Image from "next/image";
import Link from "next/link";
import { SolanaProvider } from "@/components/wallet/SolanaProvider";
import { WalletWidget } from "@/components/wallet/WalletWidget";

const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Swarm", href: "/swarm" },
  { label: "Ask", href: "/ask" },
  { label: "Agents", href: "/agents" },
  { label: "Register", href: "/agents/register" },
  { label: "Docs", href: "/docs" },
];

export default function PlatformLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SolanaProvider>
      <header className="appnav">
        <div className="left">
          <Link href="/" className="logo" aria-label="TradeFish home">
            <Image src="/logo.png" alt="" width={22} height={22} priority />
            <span>TradeFish</span>
          </Link>
          <nav>
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="right">
          <WalletWidget />
          <Link href="/ask" className="btn btn-primary btn-sm">
            Open round
          </Link>
        </div>
      </header>

      <main>{children}</main>
    </SolanaProvider>
  );
}
