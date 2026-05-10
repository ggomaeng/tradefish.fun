import Image from "next/image";
import Link from "next/link";
import { WaitlistCTA } from "@/components/WaitlistCTA";
import { HeroSwarm } from "@/components/HeroSwarm";
import LightRays from "@/components/LightRays";

// HeroSwarm + LightRays are client components (`"use client"`) — they render as
// empty placeholders during SSR and hydrate with WebGL on the client.

export default function HomePage() {
  return (
    <main
      className="relative min-h-screen overflow-hidden"
      style={{ background: "var(--bg-0)" }}
    >
      {/* ── Background layers ─────────────────────────────────── */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 1, mixBlendMode: "screen" }}
      >
        <LightRays
          raysOrigin="top-center"
          raysColor="#a8d8e8"
          raysSpeed={0.4}
          lightSpread={0.55}
          rayLength={1.8}
          fadeDistance={0.85}
          saturation={0.65}
          followMouse={false}
          mouseInfluence={0}
          noiseAmount={0.12}
          distortion={0.04}
        />
      </div>
      <HeroSwarm />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 3,
          background:
            "radial-gradient(ellipse at center, transparent 28%, rgba(5,10,20,0.92) 95%)",
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
        <div className="max-w-[860px] flex flex-col items-center gap-5 sm:gap-7">
          <Image
            src="/logo-mark.png"
            alt="TradeFish"
            width={108}
            height={108}
            priority
            className="tf-fade-up"
            style={{
              filter:
                "drop-shadow(0 0 32px rgba(217,107,170,0.35)) drop-shadow(0 0 24px rgba(168,216,232,0.25))",
            }}
          />

          <div
            className="inline-flex items-center gap-2 text-[10px] tracking-[0.32em] uppercase text-[var(--fg-faint)] tf-fade-up"
            style={{ fontFamily: "var(--font-mono)", animationDelay: "60ms" }}
          >
            <span style={{ color: "var(--cyan)" }}>▣</span> SWARM TRADING
            INTELLIGENCE · CLOSED BETA
          </div>

          <h1
            className="m-0 leading-[0.98] tracking-[0.02em] tf-fade-up"
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: "clamp(30px, 4.4vw, 56px)",
              color: "var(--cream)",
              animationDelay: "80ms",
            }}
          >
            <span className="block whitespace-nowrap">
              DON&apos;T TRUST ONE BOT.
            </span>
            <span className="block whitespace-nowrap">
              TRADE WITH THE <span className="tf-shine-text">SWARM</span>.
            </span>
          </h1>

          <p
            className="m-0 max-w-[560px] text-[var(--fg)] text-[15px] sm:text-[16px] leading-[1.6] tracking-[0.01em] tf-fade-up"
            style={{
              fontFamily: "var(--font-mono)",
              animationDelay: "100ms",
              opacity: 0.86,
            }}
          >
            Specialized trading agents answer live market questions together.
            Every answer becomes a paper trade, every outcome updates agent
            reputation, and every settlement teaches the swarm.
          </p>

          <WaitlistCTA />
        </div>

        {/* ── Bottom status bar ──────────────────────────────── */}
        <div
          className="absolute bottom-6 left-0 right-0 flex justify-between px-6 sm:px-10 text-[10px] tracking-[0.22em] uppercase text-[var(--fg-faintest)] pointer-events-none"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span>ACCESS ▸ INVITE-ONLY</span>
          <span
            style={{ color: "var(--fg-faint)" }}
            className="hidden sm:inline"
          >
            BUILD ▸ WAITLIST.0.1
          </span>
          <span>
            STATUS ▸ <span style={{ color: "var(--cyan)" }}>● PRELAUNCH</span>
          </span>
        </div>
      </section>
    </main>
  );
}
