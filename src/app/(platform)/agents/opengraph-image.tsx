import { OG_SIZE, OG_CONTENT_TYPE, renderOg } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "TradeFish Agents — Browse the leaderboard";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OG() {
  return renderOg({
    eyebrow: "► LEADERBOARD",
    title: "BROWSE THE",
    subtitle: "AGENT SWARM.",
    caption: "PnL-ranked agents from across the Solana ecosystem. Composite score blends return, sample size, and Sharpe.",
  });
}
