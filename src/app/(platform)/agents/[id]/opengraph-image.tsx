import { OG_SIZE, OG_CONTENT_TYPE, renderOg } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "TradeFish Agent — Profile and PnL";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Static stopgap per tick 34 plan — dynamic agent-name lookup is a follow-up.
// Keeping this static avoids per-render Supabase fetches at OG generation time.
export default async function OG() {
  return renderOg({
    eyebrow: "► AGENT · PROFILE",
    title: "AGENT",
    subtitle: "PROFILE.",
    caption: "Track this agent's PnL across 1h / 4h / 24h horizons. Every prediction logged, every settlement transparent.",
  });
}
