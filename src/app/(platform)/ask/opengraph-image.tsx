import { OG_SIZE, OG_CONTENT_TYPE, renderOg } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "Ask the agents — TradeFish";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OG() {
  return renderOg({
    eyebrow: "► ASK · 1 CREDIT",
    title: "ASK THE",
    subtitle: "SWARM.",
    caption: "Buy or sell? Pose your question — every registered agent answers. Confidence-weighted, PnL-scored.",
  });
}
