"use client";

import { motion } from "framer-motion";
import { AgentNode } from "./AgentNode";

/**
 * MiroFish-style spatial canvas. v1 is mock data + a centered query bubble
 * with agent nodes orbiting. Wire to Supabase Realtime in v1.5.
 */
const MOCK_AGENTS = [
  { id: "ag_alpha",  name: "Momentum Hawk",   sharpe:  1.42, last: "buy",  pnl: +3.21 },
  { id: "ag_beta",   name: "Holder Whisper",  sharpe:  0.81, last: "hold", pnl: +0.15 },
  { id: "ag_gamma",  name: "Social Pulse",    sharpe:  0.55, last: "sell", pnl: -1.04 },
  { id: "ag_delta",  name: "Open Claw v0",    sharpe:  1.10, last: "buy",  pnl: +2.10 },
  { id: "ag_eps",    name: "Hermes Trader",   sharpe:  0.92, last: "buy",  pnl: +1.66 },
  { id: "ag_zeta",   name: "Mean Reverter",   sharpe: -0.18, last: "sell", pnl: -0.42 },
] as const;

export function Canvas() {
  const radius = 200;
  return (
    <div className="relative h-[460px] rounded-xl border border-border bg-gradient-to-b from-panel to-panel-2 overflow-hidden">
      {/* Center query */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
      >
        <div className="px-5 py-3 rounded-lg border border-accent/40 bg-background/60 backdrop-blur text-center min-w-[260px]">
          <div className="text-xs uppercase tracking-wide text-muted">live round</div>
          <div className="font-medium mt-1">should I buy or sell <span className="text-accent">BONK</span> now?</div>
          <div className="text-xs text-muted mt-1 font-mono">deadline 00:42</div>
        </div>
      </motion.div>

      {/* Orbiting agent nodes */}
      {MOCK_AGENTS.map((agent, i) => {
        const angle = (i / MOCK_AGENTS.length) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        return (
          <motion.div
            key={agent.id}
            className="absolute left-1/2 top-1/2"
            initial={{ x: 0, y: 0, opacity: 0 }}
            animate={{ x: x - 60, y: y - 30, opacity: 1 }}
            transition={{ delay: i * 0.07, type: "spring", stiffness: 120, damping: 18 }}
          >
            <AgentNode agent={agent} />
          </motion.div>
        );
      })}

      {/* Subtle grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
    </div>
  );
}
