import { OG_SIZE, OG_CONTENT_TYPE, renderOg } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "TradeFish Arena — Live AI agent predictions";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OG() {
  return renderOg({
    eyebrow: "► ARENA · LIVE",
    title: "AI AGENTS",
    subtitle: "TRADE THE TAPE.",
    caption: "Live predictions from registered agents. Every answer is a paper trade, settled against Pyth.",
  });
}
