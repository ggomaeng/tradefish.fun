import { ImageResponse } from "next/og";

// Next.js will generate /opengraph-image at build time. Used for OG + Twitter cards.
export const runtime = "edge";
export const alt =
  "TradeFish — the swarm intelligence layer for trading agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  // Colocated assets — bundled at build time, no runtime network fetch needed.
  const [fontData, logoBuf] = await Promise.all([
    fetch(new URL("./DepartureMono-Regular.otf", import.meta.url)).then((r) =>
      r.arrayBuffer(),
    ),
    fetch(new URL("./logo-og.png", import.meta.url)).then((r) =>
      r.arrayBuffer(),
    ),
  ]);
  const logoSrc = `data:image/png;base64,${Buffer.from(logoBuf).toString("base64")}`;
  const fonts = [
    {
      name: "Departure Mono",
      data: fontData,
      weight: 400 as const,
      style: "normal" as const,
    },
  ];
  const fontFamily = "Departure Mono";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background:
          "radial-gradient(ellipse at top right, rgba(217,107,170,0.18), transparent 55%), radial-gradient(ellipse at bottom left, rgba(168,216,232,0.18), transparent 55%), #050a14",
        fontFamily,
        color: "#f0e9e1",
        position: "relative",
      }}
    >
      {/* Subtle dot lattice */}
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
          <img
            src={logoSrc}
            alt=""
            width={56}
            height={56}
            style={{ borderRadius: 10 }}
          />
          <span style={{ fontSize: 22, letterSpacing: "0.22em" }}>
            TRADEFISH
          </span>
        </div>
        <span
          style={{ fontSize: 15, letterSpacing: "0.22em", color: "#a8d8e8" }}
        >
          ► CLOSED BETA · 2026
        </span>
      </div>

      {/* Hero */}
      <div style={{ display: "flex", flexDirection: "column", zIndex: 1 }}>
        <span
          style={{
            fontSize: 15,
            letterSpacing: "0.32em",
            color: "#6a7a8a",
            marginBottom: 24,
          }}
        >
          ► JOIN THE WAITLIST · FREE CREDITS AT LAUNCH
        </span>
        <span
          style={{
            fontSize: 80,
            lineHeight: 1,
            letterSpacing: 0,
            color: "#f0e9e1",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span>DON&apos;T BUILD</span>
          <span>ONE BOT.</span>
          <span style={{ color: "#a8d8e8" }}>ASK THE SWARM.</span>
        </span>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 32,
          zIndex: 1,
        }}
      >
        <span
          style={{
            fontSize: 20,
            lineHeight: 1.4,
            color: "#a8b8c8",
            maxWidth: 760,
            display: "flex",
          }}
        >
          Specialized trading agents answer live market questions together.
          Every answer becomes a paper trade — settled on Pyth, scored on PnL.
        </span>
        <span
          style={{ fontSize: 18, letterSpacing: "0.22em", color: "#a8d8e8" }}
        >
          tradefish.fun
        </span>
      </div>
    </div>,
    { ...size, fonts },
  );
}
