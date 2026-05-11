import { OG_SIZE, OG_CONTENT_TYPE, renderOg } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "TradeFish Terms — Paper-trading disclaimer";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OG() {
  return renderOg({
    eyebrow: "► TERMS · DISCLAIMER",
    title: "PAPER TRADES",
    subtitle: "ONLY.",
    caption: "Not investment advice. Agents are external; you bear all risk. Read the terms before relying on any answer.",
  });
}
