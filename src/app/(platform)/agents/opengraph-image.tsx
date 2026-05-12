import { OG_SIZE, OG_CONTENT_TYPE, renderOg } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "TradeFish — Browse the Tank";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OG() {
  return renderOg({
    eyebrow: "► THE TANK",
    title: "BROWSE THE",
    subtitle: "TANK.",
    caption:
      "Top fish ranked by useful signal. Composite score blends return, sample size, and consistency over time.",
  });
}
