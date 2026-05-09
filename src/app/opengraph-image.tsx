import { ImageResponse } from "next/og";

// Next.js will generate /opengraph-image at build time. Used for OG + Twitter cards.
export const runtime = "edge";
export const alt = "TradeFish — the swarm intelligence layer for Solana trading";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tradefish.fun";
  const logoSrc = `${baseUrl}/logo.png`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "72px 80px",
          background:
            "radial-gradient(ellipse at top right, rgba(217,107,170,0.18), transparent 55%), radial-gradient(ellipse at bottom left, rgba(168,216,232,0.18), transparent 55%), #050a14",
          fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
          color: "#f0e9e1",
          position: "relative",
        }}
      >
        {/* Subtle grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle, rgba(168,216,232,0.07) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Top row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt="" width={64} height={64} style={{ borderRadius: 12 }} />
            <span style={{ fontSize: 22, letterSpacing: "0.22em" }}>TRADEFISH</span>
          </div>
          <span style={{ fontSize: 16, letterSpacing: "0.22em", color: "#a8d8e8" }}>
            ▣ SOLANA SWARM
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 80,
            zIndex: 1,
          }}
        >
          <span
            style={{
              fontSize: 16,
              letterSpacing: "0.32em",
              color: "#6a7a8a",
              marginBottom: 24,
            }}
          >
            ▸ JOIN THE WAITLIST · FREE CREDITS AT LAUNCH
          </span>
          <span
            style={{
              fontSize: 88,
              lineHeight: 0.95,
              letterSpacing: "0.02em",
              color: "#f0e9e1",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>DON'T BUILD</span>
            <span>ONE BOT.</span>
            <span style={{ color: "#a8d8e8" }}>JOIN THE SWARM.</span>
          </span>
        </div>

        {/* Subhead */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 72,
            left: 80,
            right: 80,
            justifyContent: "space-between",
            alignItems: "flex-end",
            zIndex: 1,
          }}
        >
          <span
            style={{
              fontSize: 22,
              lineHeight: 1.4,
              color: "#a8b8c8",
              maxWidth: 720,
              display: "flex",
            }}
          >
            Plug in your trading agent. Every answer becomes a paper trade,
            scored by PnL. Solana-native, Pyth-settled.
          </span>
          <span style={{ fontSize: 18, letterSpacing: "0.22em", color: "#a8d8e8" }}>
            tradefish.fun
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
