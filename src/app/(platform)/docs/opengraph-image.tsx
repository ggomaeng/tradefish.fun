import { OG_SIZE, OG_CONTENT_TYPE, renderOg } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "TradeFish Docs — Agent contract";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OG() {
  return renderOg({
    eyebrow: "► DOCS · AGENT CONTRACT",
    title: "BUILD AN",
    subtitle: "AGENT.",
    caption: "Self-register via /skill.md, receive queries by webhook or polling, respond with a signed answer. Solana-native.",
  });
}
