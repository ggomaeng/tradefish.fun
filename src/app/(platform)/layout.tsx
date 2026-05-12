import Image from "next/image";
import Link from "next/link";
import { SolanaProvider } from "@/components/wallet/SolanaProvider";
import { WalletWidget } from "@/components/wallet/WalletWidget";

// Demo mode: hard-coded ON for the hackathon launch since we don't have
// Vercel dashboard access to set NEXT_PUBLIC_FREE_DEMO=1. Flip back to
// `process.env.NEXT_PUBLIC_FREE_DEMO === "1"` (and patch the other three
// callsites: layout.tsx, WalletWidget.tsx, QueryComposer.tsx, queries/route.ts)
// when the paywall should go live in production.
const FREE_DEMO = true;

const NAV_LINKS: { label: string; href: string; hideOnMobile?: boolean }[] = [
  { label: "SWARM", href: "/swarm" },
  { label: "ASK", href: "/ask" },
  { label: "AGENTS", href: "/agents" },
  { label: "BRAIN", href: "/brain", hideOnMobile: true },
  { label: "DOCS", href: "/docs", hideOnMobile: true },
];

export default function PlatformLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SolanaProvider>
      {/* Header — mirrors landing nav (logo-mark + Departure Mono wordmark +
          mono uppercase links). Sticky with backdrop so it stays legible over
          scrolling platform content; landing uses `absolute` because it floats
          over the hero gradient. */}
      <header
        className="sticky top-0 flex items-center justify-between px-6 sm:px-10 py-4"
        style={{
          zIndex: 60,
          background: "rgba(7, 7, 12, 0.72)",
          backdropFilter: "blur(12px) saturate(140%)",
          WebkitBackdropFilter: "blur(12px) saturate(140%)",
          borderBottom: "1px solid var(--bd-1)",
        }}
      >
        <div className="flex items-center gap-6 sm:gap-8">
          <Link
            href="/"
            className="flex items-center gap-3 group"
            aria-label="TradeFish home"
          >
            <Image
              src="/logo-mark.png"
              alt="TradeFish"
              width={28}
              height={28}
              priority
              style={{
                filter: "drop-shadow(0 0 12px rgba(168,216,232,0.35))",
              }}
            />
            <span
              className="text-[13px] tracking-[0.22em]"
              style={{
                fontFamily: "var(--font-pixel)",
                color: "var(--cream)",
              }}
            >
              TRADEFISH
            </span>
          </Link>
          <nav
            className="flex items-center gap-4 sm:gap-5 text-[10px] tracking-[0.22em] uppercase"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--fg-faint)",
            }}
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`hover:text-[var(--cream)] transition-colors ${
                  link.hideOnMobile ? "hidden sm:inline" : ""
                }`}
              >
                {link.label}
              </Link>
            ))}
            <span
              aria-hidden
              className="hidden sm:inline"
              style={{ color: "var(--fg-faintest)" }}
            >
              ·
            </span>
            <a
              href="https://x.com/tradefish_fun"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[var(--cream)] transition-colors hidden sm:inline"
            >
              X / TWITTER
            </a>
            <a
              href="https://github.com/tradefish-fun/tradefish.fun"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[var(--cream)] transition-colors hidden md:inline"
            >
              GITHUB
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {!FREE_DEMO && <WalletWidget />}
        </div>
      </header>

      <main>{children}</main>
    </SolanaProvider>
  );
}
