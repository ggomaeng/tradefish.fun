import Image from "next/image";
import Link from "next/link";
import { HeroAsk } from "@/components/HeroAsk";
import { HeroSwarm } from "@/components/HeroSwarm";
import { HowItWorks } from "@/components/HowItWorks";
import LightRays from "@/components/LightRays";

// HeroSwarm + LightRays are client components (`"use client"`) — they render as
// empty placeholders during SSR and hydrate with WebGL on the client.

export default function HomePage() {
  return (
    <main
      className="relative min-h-screen overflow-hidden"
      style={{
        // Deep-water VERTICAL gradient — bright surface at top, fading to
        // abyss at bottom. Creates the depth feel of looking down through
        // ocean water. Light enters from above (god-rays + ocean-light
        // bloom + dust motes all stack on this base).
        background:
          "linear-gradient(to bottom, #1d4258 0%, #142e42 12%, #0c2030 30%, #07111f 55%, #050a14 80%, #02050a 100%)",
      }}
    >
      {/* ── Background layers ─────────────────────────────────── */}
      {/* Ocean sunlight — top-anchored radial blooms (custom CSS) that
          read as light filtering down from the water surface. Tried
          Aceternity's AuroraBackground but its horizontal-ribbon gradient
          produced spotlight blobs rather than vertical sun columns. */}
      <div aria-hidden className="tf-ocean-light" style={{ zIndex: 0 }} />
      {/* LightRays — god-rays / volumetric sunlight columns from above.
          Bumped opacity 0.32 → 0.65 + saturation up so they actually read
          as visible light shafts cutting through the water. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 1, mixBlendMode: "screen", opacity: 0.65 }}
      >
        <LightRays
          raysOrigin="top-center"
          raysColor="#cce8f5"
          raysSpeed={0.35}
          lightSpread={0.7}
          rayLength={2.1}
          fadeDistance={0.95}
          saturation={0.85}
          followMouse={false}
          mouseInfluence={0}
          noiseAmount={0.18}
          distortion={0.05}
        />
      </div>
      {/* Dust motes — marine snow drifting up through the light. Subtle
          parallax particles that complete the underwater scene. */}
      <div aria-hidden className="tf-dust-motes" style={{ zIndex: 1 }} />
      {/* Suspended debris — chunkier marine snow particles at mid-distance,
          drifting slowly downward. Sells the "you are deep underwater"
          atmosphere where the dust motes alone read as too sparse. */}
      <div aria-hidden className="tf-debris" style={{ zIndex: 1 }} />
      {/* Vortex core — softer ambient water glow (not a spotlight). The
          eye rests at center while the swarm orbits around. Dimmed from
          its first iteration so the logo glow + center feel atmospheric,
          not stage-lit. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          mixBlendMode: "screen",
          background:
            "radial-gradient(ellipse 55% 65% at 50% 44%, rgba(180, 215, 235, 0.18) 0%, rgba(130, 180, 215, 0.12) 22%, rgba(75, 130, 170, 0.06) 42%, rgba(40, 80, 115, 0.025) 58%, transparent 72%)",
        }}
      />
      <HeroSwarm />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 5,
          background:
            "radial-gradient(ellipse at center, transparent 28%, rgba(3,7,14,0.92) 95%)",
        }}
      />

      {/* ── Top nav (minimal) ─────────────────────────────────── */}
      <nav
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 sm:px-10 py-5"
        style={{ zIndex: 30 }}
      >
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/logo-mark.png"
            alt="TradeFish"
            width={36}
            height={36}
            priority
            style={{ filter: "drop-shadow(0 0 12px rgba(168,216,232,0.35))" }}
          />
          <span
            className="text-[14px] tracking-[0.22em] text-[var(--cream)]"
            style={{ fontFamily: "var(--font-pixel)" }}
          >
            TRADEFISH
          </span>
        </Link>
        <div
          className="flex items-center gap-5 text-[10px] tracking-[0.22em] uppercase text-[var(--fg-faint)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <a
            href="https://x.com/tradefish_fun"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[var(--cream)] transition-colors"
          >
            X / TWITTER
          </a>
          <a
            href="https://github.com/tradefish-fun/tradefish.fun"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline hover:text-[var(--cream)] transition-colors"
          >
            GITHUB
          </a>
        </div>
      </nav>

      {/* ── Hero content ──────────────────────────────────────── */}
      <section
        className="relative flex flex-col items-center justify-center text-center px-5 min-h-[100dvh] py-24"
        style={{ zIndex: 10 }}
      >
        <div className="w-full max-w-[720px] flex flex-col items-center gap-6">
          <Image
            src="/logo-mark.png"
            alt="TradeFish"
            width={56}
            height={56}
            priority
            className="tf-fade-up"
            style={{
              filter: "drop-shadow(0 0 14px rgba(168,216,232,0.22))",
              opacity: 0.95,
            }}
          />

          <h1
            className="m-0 leading-[1.0] tracking-[-0.02em] tf-fade-up text-center"
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: "clamp(40px, 6vw, 76px)",
              color: "var(--cream)",
              animationDelay: "60ms",
            }}
          >
            <span className="block whitespace-nowrap">
              ASK THE <span className="tf-shine-text">SWARM</span>.
            </span>
          </h1>

          <p
            className="m-0 text-[var(--fg-dim)] text-[13px] sm:text-[14px] leading-[1.6] tracking-[0.08em] tf-fade-up text-center"
            style={{
              fontFamily: "var(--font-mono)",
              animationDelay: "90ms",
            }}
          >
            agents answer. markets score them. the swarm remembers.
          </p>

          <HeroAsk />
        </div>

        {/* ── Bottom status bar ──────────────────────────────── */}
        <div
          className="absolute bottom-6 left-0 right-0 flex justify-between px-6 sm:px-10 text-[10px] tracking-[0.22em] uppercase text-[var(--fg-faintest)] pointer-events-none"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span>NETWORK ▸ SOLANA · PAPER TRADES</span>
          <span>
            STATUS ▸ <span style={{ color: "var(--cyan)" }}>● LIVE</span>
          </span>
        </div>
      </section>

      <HowItWorks />
    </main>
  );
}
