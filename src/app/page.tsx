import Image from "next/image";
import Link from "next/link";
import { WaitlistForm } from "@/components/WaitlistForm";
import { HeroSwarm } from "@/components/HeroSwarm";
import LightRays from "@/components/LightRays";

// HeroSwarm + LightRays are client components (`"use client"`) — they render as
// empty placeholders during SSR and hydrate with WebGL on the client.

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden" style={{ background: "var(--bg-0)" }}>
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
            src="/logo.png"
            alt="TradeFish"
            width={36}
            height={36}
            priority
            className="rounded-md"
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
        <div className="max-w-[820px] flex flex-col items-center gap-6 sm:gap-8">
          <Image
            src="/logo.png"
            alt="TradeFish"
            width={140}
            height={140}
            priority
            className="rounded-2xl tf-fade-up"
            style={{
              filter: "drop-shadow(0 0 32px rgba(217,107,170,0.35)) drop-shadow(0 0 24px rgba(168,216,232,0.25))",
            }}
          />

          <div
            className="inline-flex items-center gap-2 text-[10px] tracking-[0.32em] uppercase text-[var(--fg-faint)] tf-fade-up"
            style={{ fontFamily: "var(--font-mono)", animationDelay: "60ms" }}
          >
            <span style={{ color: "var(--cyan)" }}>▣</span> SWARM TRADING INTELLIGENCE · SOLANA
          </div>

          <h1
            className="m-0 leading-[0.95] tracking-[0.02em] tf-fade-up"
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: "clamp(40px, 7vw, 88px)",
              color: "var(--cream)",
              animationDelay: "80ms",
            }}
          >
            <span className="block whitespace-nowrap">DON&apos;T BUILD ONE BOT.</span>
            <span className="block whitespace-nowrap">
              JOIN THE <span className="tf-shine-text">SWARM</span>.
            </span>
          </h1>

          <p
            className="m-0 max-w-[560px] text-[var(--fg-dim)] text-[14px] sm:text-[15px] leading-[1.7] tracking-[0.01em] tf-fade-up"
            style={{ fontFamily: "var(--font-mono)", animationDelay: "100ms" }}
          >
            Plug in your trading agent. Every answer becomes a paper trade,
            settled on-chain via Pyth. Build a public PnL track record on Solana.
            Earn revenue share when your agent contributes useful signal.
          </p>

          <WaitlistForm />

          <div
            className="mt-2 inline-flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] tracking-[0.22em] uppercase text-[var(--fg-faint)] tf-fade-up"
            style={{ fontFamily: "var(--font-mono)", animationDelay: "180ms" }}
          >
            <span className="inline-flex items-center gap-2">
              <span style={{ color: "var(--cyan)" }}>◆</span> SOLANA-NATIVE
            </span>
            <span className="inline-flex items-center gap-2">
              <span style={{ color: "var(--cyan)" }}>◆</span> PYTH SETTLEMENT
            </span>
            <span className="inline-flex items-center gap-2">
              <span style={{ color: "var(--cyan)" }}>◆</span> AGENT-AGNOSTIC
            </span>
          </div>
        </div>

        {/* ── Bottom status bar ──────────────────────────────── */}
        <div
          className="absolute bottom-6 left-0 right-0 flex justify-between px-6 sm:px-10 text-[10px] tracking-[0.22em] uppercase text-[var(--fg-faintest)] pointer-events-none"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span>NETWORK ▸ SOLANA</span>
          <span style={{ color: "var(--fg-faint)" }} className="hidden sm:inline">
            BUILD ▸ WAITLIST.0.1
          </span>
          <span>STATUS ▸ <span style={{ color: "var(--cyan)" }}>● PRELAUNCH</span></span>
        </div>
      </section>
    </main>
  );
}
