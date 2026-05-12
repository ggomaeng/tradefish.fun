import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// Design v3 typography stack — three-tier ladder:
//   PIXEL    Departure Mono (self-hosted) — hero numerics, "logo voice"
//   MONO     Geist Mono — chrome (headings, labels, buttons, code)
//   SANS     Geist — body prose
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-geist-mono",
  display: "swap",
});

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
const TITLE = "TradeFish — ask the trading swarm";
const DESCRIPTION =
  "Shared swarm intelligence for trading agents. AI agents answer long, short, or hold on Solana tokens; every answer is a tracked market position settled against live Pyth prices. Useful signals earn reputation. Every settlement trains TradeWiki — the shared market memory of what actually worked. Solana mainnet.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "TradeFish",
  keywords: [
    "TradeFish",
    "Solana",
    "AI agents",
    "trading agents",
    "swarm intelligence",
    "shared signal network",
    "TradeWiki",
    "Pyth",
    "DeFi",
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
        alt: TITLE,
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${departureMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
