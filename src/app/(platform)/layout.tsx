import Link from "next/link";
import { SolanaProvider } from "@/components/wallet/SolanaProvider";
import { WalletWidget } from "@/components/wallet/WalletWidget";

/**
 * Shared layout for the post-waitlist platform routes.
 *
 * The root layout (src/app/layout.tsx) owns waitlist metadata and the
 * Departure Mono localFont setup — this layout inherits both and adds
 * the platform-wide top nav + the Solana wallet provider so any client
 * component under (platform)/* can call useWallet() / useConnection().
 * Route groups (parens) don't affect URLs, so /arena, /ask, /agents,
 * /round, /docs, /claim still resolve at the same paths they did before.
 *
 * Visual reference: .claude/skills/tradefish-design/index.html (.nav block).
 */

const NAV_LINKS: { label: string; href: string }[] = [
  { label: "HOME", href: "/" },
  { label: "ARENA", href: "/arena" },
  { label: "ASK", href: "/ask" },
  { label: "AGENTS", href: "/agents" },
  { label: "REGISTER", href: "/agents/register" },
  { label: "DOCS", href: "/docs" },
];

export default function PlatformLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SolanaProvider>
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "18px 32px",
          zIndex: 100,
          background:
            "linear-gradient(180deg, rgba(7, 7, 12, 0.85), rgba(7, 7, 12, 0))",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          pointerEvents: "auto",
        }}
      >
        <Link
          href="/"
          aria-label="TradeFish home"
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: "18px",
            letterSpacing: "0.2em",
            color: "var(--fg)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ color: "var(--cyan)" }} aria-hidden="true">
            ◆
          </span>
          <span>
            TRADE<span className="t-spectrum">FISH</span>
          </span>
        </Link>

        <div
          style={{
            display: "flex",
            gap: "28px",
            alignItems: "center",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{ color: "var(--fg-faint)", textDecoration: "none" }}
              className="tf-nav-link"
            >
              {link.label}
            </Link>
          ))}
          <WalletWidget />
          <Link
            href="/ask"
            style={{
              padding: "8px 16px",
              border: "1px solid var(--line-strong)",
              color: "var(--fg)",
              textDecoration: "none",
              letterSpacing: "0.2em",
            }}
            className="tf-nav-pill"
          >
            OPEN ROUND →
          </Link>
        </div>
      </nav>

      {/* Spacer so fixed nav doesn't overlap page content. */}
      <div style={{ height: "70px" }} aria-hidden="true" />

      {children}
    </SolanaProvider>
  );
}
