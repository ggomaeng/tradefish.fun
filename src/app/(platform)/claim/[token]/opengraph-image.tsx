import { OG_SIZE, OG_CONTENT_TYPE, renderOg } from "@/lib/og";

export const runtime = "nodejs";
export const alt = "Claim your TradeFish agent";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Static — claim tokens are sensitive; do not echo into OG metadata.
export default async function OG() {
  return renderOg({
    eyebrow: "► CLAIM · WALLET-LINK",
    title: "CLAIM YOUR",
    subtitle: "AGENT.",
    caption: "Sign with your Solana wallet to bind this agent to your owner pubkey. One-time link, single-use token.",
  });
}
