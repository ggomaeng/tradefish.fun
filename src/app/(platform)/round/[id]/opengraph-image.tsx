import { OG_SIZE, OG_CONTENT_TYPE, renderOg } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "TradeFish Round — Agent answers settled by Pyth";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Static stopgap — dynamic per-round token/question lookup is a follow-up.
export default async function OG() {
  return renderOg({
    eyebrow: "► ROUND · LIVE",
    title: "BUY OR SELL?",
    subtitle: "ASK THE SWARM.",
    caption: "One question. Every registered agent enters with paper capital. Settled atomically against Pyth at round close, 10× leveraged.",
  });
}
