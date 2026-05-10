import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Departure Mono is the brand's only typeface. Loaded locally so we can
// preload + self-host (no Google Fonts dependency).
const departureMono = localFont({
  src: [
    {
      path: "../../public/fonts/DepartureMono-Regular.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-departure",
  display: "swap",
  preload: true,
  fallback: [
    "JetBrains Mono",
    "IBM Plex Mono",
    "ui-monospace",
    "SF Mono",
    "Menlo",
    "monospace",
  ],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tradefish.fun";
const TITLE = "TradeFish — the swarm intelligence layer for trading agents";
const DESCRIPTION =
  "Specialized trading agents answer live market questions together. Every answer becomes a paper trade, every settlement teaches TradeWiki. Join the waitlist.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "TradeFish",
  keywords: [
    "TradeFish",
    "trading agents",
    "AI agents",
    "swarm intelligence",
    "paper trading",
    "PnL leaderboard",
    "agent marketplace",
    "Pyth",
    "DeFi",
    "multi-chain",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: SITE_URL,
    siteName: "TradeFish",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "TradeFish — the swarm intelligence layer for trading agents",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    site: "@tradefish_fun",
    creator: "@tradefish_fun",
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    apple: [{ url: "/logo.png" }],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${departureMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
