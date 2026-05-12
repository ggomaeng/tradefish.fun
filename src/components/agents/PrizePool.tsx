"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PAYOUTS, PRIZE_END_AT } from "./prize-pool-config";

// ── Countdown hook ────────────────────────────────────────────────────────
function useCountdown(target: Date): string {
  const [mounted, setMounted] = useState(false);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    setMounted(true);
    const calc = () => Math.max(0, target.getTime() - Date.now());
    setRemaining(calc());
    const t = setInterval(() => setRemaining(calc()), 1000);
    return () => clearInterval(t);
  }, [target]);

  if (!mounted) return "--d --h --m --s";

  if (remaining === 0) return "SEASON ENDED";

  const totalSec = Math.floor(remaining / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  return `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

// ── Component ─────────────────────────────────────────────────────────────
export default function PrizePool() {
  const countdown = useCountdown(PRIZE_END_AT);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
      style={{
        position: "relative",
        borderRadius: "var(--r-4)",
        border: "1px solid var(--bd-2)",
        overflow: "hidden",
        marginBottom: 32,
        /* Glassmorphic: semi-transparent bg over a soft radial backlight */
        background: "rgba(15,15,17,0.72)",
        backdropFilter: "blur(20px) saturate(150%)",
        WebkitBackdropFilter: "blur(20px) saturate(150%)",
        boxShadow:
          "0 1px 0 var(--bd-1) inset, 0 24px 60px rgba(0,0,0,0.55)",
      }}
    >
      {/* Radial backlight — cyan + up at low alpha */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 70% 120% at 20% -10%, rgba(94,234,240,0.10), transparent 60%), " +
            "radial-gradient(ellipse 50% 100% at 80% 110%, rgba(20,241,149,0.08), transparent 60%)",
          zIndex: 0,
        }}
      />

      {/* Content — layered above backlight */}
      <div style={{ position: "relative", zIndex: 1, padding: "28px 32px 24px" }}>

        {/* Season chip */}
        <div style={{ marginBottom: 20 }}>
          <span
            className="chip chip-live"
            style={{ fontSize: 10, letterSpacing: "0.10em" }}
          >
            <span className="dot" />
            SEASON 01 · LIVE
          </span>
        </div>

        {/* Hero row: prize pool amount + countdown */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 20,
            marginBottom: 28,
          }}
        >
          {/* Hero number */}
          <div>
            <div
              className="t-mini"
              style={{ marginBottom: 6, color: "var(--fg-3)" }}
            >
              TOTAL PRIZE POOL
            </div>
            <div
              className="num"
              style={{
                fontSize: "clamp(56px, 7vw, 96px)",
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: "-0.03em",
                /* Cyan-to-up gradient text fill */
                background:
                  "linear-gradient(135deg, var(--cyan) 0%, var(--up) 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                WebkitTextFillColor: "transparent",
                textShadow: "none",
                /* Subtle glow via filter drop-shadow */
                filter:
                  "drop-shadow(0 0 18px rgba(94,234,240,0.22)) drop-shadow(0 0 6px rgba(20,241,149,0.15))",
              }}
            >
              $10,000
            </div>
          </div>

          {/* Countdown */}
          <div style={{ textAlign: "right" }}>
            <div
              className="t-mini"
              style={{ marginBottom: 6, color: "var(--fg-3)" }}
            >
              ENDS IN
            </div>
            <div
              suppressHydrationWarning
              className="num"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "clamp(20px, 2.5vw, 28px)",
                fontWeight: 500,
                letterSpacing: "0.02em",
                color: "var(--cyan)",
              }}
            >
              {countdown}
            </div>
          </div>
        </div>

        {/* Distribution strip */}
        <div
          className="prize-pool-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
            marginBottom: 20,
          }}
        >
          {PAYOUTS.map((p) => (
            <div
              key={p.rank}
              style={{
                background: p.rank === 1 ? "rgba(20,241,149,0.07)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${p.rank === 1 ? "var(--up-bd)" : "var(--bd-1)"}`,
                borderRadius: "var(--r-3)",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div
                className="t-mini"
                style={{
                  color: p.rank === 1 ? "var(--up)" : "var(--fg-3)",
                }}
              >
                {p.label} PLACE
              </div>
              <div
                className="num"
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  color: p.rank === 1 ? "var(--up)" : "var(--fg-2)",
                }}
              >
                {p.amount}
              </div>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: "var(--fg-3)",
              lineHeight: 1.4,
              maxWidth: 480,
              textAlign: "right",
            }}
          >
            Demonstration for the hackathon — real prize distribution and treasury sourcing are future work.
          </p>
        </div>
      </div>

      {/* Responsive: stack distribution to 2x2 on narrow screens */}
      <style>{`
        @media (max-width: 640px) {
          .prize-pool-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </motion.div>
  );
}
