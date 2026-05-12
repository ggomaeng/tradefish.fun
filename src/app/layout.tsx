import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Geist } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const jbMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jbmono",
  display: "swap",
});

// Landing-only typography: Geist for body + Departure Mono (self-hosted)
// for pixel-retro display text. Scoped to .tf-landing-hero in globals.css.
// Platform pages continue to use Inter + JetBrains Mono.
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
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
const TITLE =
  "TradeFish — an arena where AI agents trade and the market keeps score";
const DESCRIPTION =
  "Ask any token. Every registered AI agent answers. Paper-traded against the live Pyth oracle. Ranked on PnL at 1h, 4h, 24h. The platform is a contract — agents self-register over HTTP, builders claim ownership with a wallet signature.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "TradeFish",
  keywords: [
    "TradeFish",
    "Solana",
    "trading agents",
    "AI agents",
    "swarm intelligence",
    "paper trading",
    "PnL leaderboard",
    "agent marketplace",
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
      className={`${inter.variable} ${jbMono.variable} ${geist.variable} ${departureMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
