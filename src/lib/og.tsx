import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

// Standard OG dimensions (Open Graph + Twitter card).
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

// Assets live in src/app/. Read from disk via process.cwd() — file:// fetch is
// not implemented in the Next.js nodejs OG runtime, so we use fs directly.
const FONT_PATH = path.join(process.cwd(), "src/app/DepartureMono-Regular.otf");
const LOGO_PATH = path.join(process.cwd(), "src/app/logo-og.png");

let assetCache: Promise<{ fontData: Buffer; logoSrc: string }> | null = null;
async function loadAssets() {
  if (!assetCache) {
    assetCache = (async () => {
      const [fontData, logoBuf] = await Promise.all([readFile(FONT_PATH), readFile(LOGO_PATH)]);
      const logoSrc = `data:image/png;base64,${logoBuf.toString("base64")}`;
      return { fontData, logoSrc };
    })();
  }
  return assetCache;
}

export type OgPanel = {
  eyebrow: string; // small uppercase tag, e.g. "► SWARM"
  title: string; // primary headline, 1-3 words ideal
  subtitle?: string; // optional second line of headline
  caption?: string; // bottom-left descriptor, full sentence ok
};

export async function renderOg(panel: OgPanel): Promise<ImageResponse> {
  const { fontData, logoSrc } = await loadAssets();
  const fontFamily = "Departure Mono";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background:
            "radial-gradient(ellipse at top right, rgba(94,234,240,0.16), transparent 55%), radial-gradient(ellipse at bottom left, rgba(255,77,109,0.12), transparent 55%), #0A0A0B",
          fontFamily,
          color: "#F5F5F7",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle, rgba(94,234,240,0.07) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt="" width={56} height={56} style={{ borderRadius: 10 }} />
            <span style={{ fontSize: 22, letterSpacing: "0.22em" }}>TRADEFISH</span>
          </div>
          <span style={{ fontSize: 15, letterSpacing: "0.22em", color: "#5EEAF0" }}>► SOLANA SWARM</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", zIndex: 1 }}>
          <span style={{ fontSize: 15, letterSpacing: "0.32em", color: "#6E6E78", marginBottom: 24 }}>
            {panel.eyebrow}
          </span>
          <span style={{ fontSize: 80, lineHeight: 1, color: "#F5F5F7", display: "flex", flexDirection: "column" }}>
            <span>{panel.title}</span>
            {panel.subtitle ? <span style={{ color: "#5EEAF0" }}>{panel.subtitle}</span> : null}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 32, zIndex: 1 }}>
          <span style={{ fontSize: 20, lineHeight: 1.4, color: "#A0A0A8", maxWidth: 760, display: "flex" }}>
            {panel.caption ?? "Plug in your trading agent. Every answer becomes a paper trade, scored by PnL."}
          </span>
          <span style={{ fontSize: 18, letterSpacing: "0.22em", color: "#5EEAF0" }}>tradefish.fun</span>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: [{ name: fontFamily, data: fontData, weight: 400, style: "normal" }] },
  );
}
