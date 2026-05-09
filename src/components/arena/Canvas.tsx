"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AgentNode } from "./AgentNode";
import { useArenaSwarm, type ArenaAgent } from "@/lib/realtime/arena";

/**
 * MiroFish-style spatial canvas. Live data via Supabase Realtime —
 * subscribes to INSERTs on `responses` + `settlements` and re-merges
 * agent state in place. See `src/lib/realtime/arena.ts`.
 */
export function Canvas() {
  const { agents, liveRoundId, liveQuestion, liveTokenSymbol, liveDeadlineAt, loading } =
    useArenaSwarm();

  // Render up to 12 agents around the orbit.
  const orbit = useMemo(() => agents.slice(0, 12), [agents]);
  const radius = orbit.length > 6 ? 240 : 200;

  const deadlineLabel = useDeadlineCountdown(liveDeadlineAt);

  const corner = `┌─ Q-LIVE · ${orbit.length} NODE${orbit.length === 1 ? "" : "S"}`;
  const cornerRight = liveDeadlineAt
    ? `PYTH · t-${deadlineLabel} ─┐`
    : "PYTH · IDLE ─┐";

  return (
    <div
      className="tf-card relative overflow-hidden"
      style={{
        height: 460,
        background:
          "radial-gradient(ellipse at center, rgba(76,216,232,0.04), rgba(7,7,12,0))",
      }}
    >
      {/* Box-drawing corners — terminal chrome */}
      <div
        className="absolute top-0 left-0 px-3 py-2 pointer-events-none"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--t-mini)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--cyan)",
        }}
      >
        {corner}
      </div>
      <div
        className="absolute top-0 right-0 px-3 py-2 pointer-events-none"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--t-mini)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--fg-faintest)",
        }}
      >
        {cornerRight}
      </div>

      {/* Center — three states: live round / idle / loading */}
      <CenterNode
        loading={loading}
        liveRoundId={liveRoundId}
        liveQuestion={liveQuestion}
        liveTokenSymbol={liveTokenSymbol}
        deadlineLabel={deadlineLabel}
        agentCount={agents.length}
      />

      {/* Orbiting agent nodes */}
      {orbit.map((agent, i) => {
        const angle = (i / orbit.length) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        return (
          <motion.div
            key={agent.id}
            className="absolute left-1/2 top-1/2"
            initial={{ x: 0, y: 0, opacity: 0 }}
            animate={{ x: x - 75, y: y - 30, opacity: 1 }}
            transition={{ delay: i * 0.07, type: "spring", stiffness: 120, damping: 18 }}
          >
            <AgentNode agent={toNodeShape(agent)} />
          </motion.div>
        );
      })}

      {/* Dot lattice — terminal grid */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(76,216,232,0.10) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 90%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 90%)",
        }}
      />

      {/* Legend bottom-left */}
      <div
        className="absolute bottom-3 left-3 px-3 py-2 pointer-events-none"
        style={{
          background: "rgba(7,7,12,0.7)",
          border: "1px solid var(--line)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--t-micro)",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--fg-faint)",
          lineHeight: 1.7,
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ width: 6, height: 6, background: "var(--long)", display: "inline-block" }} />
          <span>BUY agent</span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ width: 6, height: 6, background: "var(--short)", display: "inline-block" }} />
          <span>SELL agent</span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ width: 6, height: 6, background: "var(--hold)", display: "inline-block" }} />
          <span>HOLD agent</span>
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────

function CenterNode({
  loading,
  liveRoundId,
  liveQuestion,
  liveTokenSymbol,
  deadlineLabel,
  agentCount,
}: {
  loading: boolean;
  liveRoundId?: string;
  liveQuestion?: string;
  liveTokenSymbol?: string;
  deadlineLabel: string;
  agentCount: number;
}) {
  // Empty agent state (loaded but no agents)
  if (!loading && agentCount === 0) {
    return (
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
      >
        <div
          className="text-center min-w-[280px]"
          style={{
            background: "rgba(7,7,12,0.85)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-0)",
            padding: "14px 18px",
            backdropFilter: "blur(6px)",
          }}
        >
          <div className="t-label" style={{ color: "var(--fg-faint)" }}>
            ▸ NO AGENTS LIVE
          </div>
          <div
            className="mt-1"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--t-mini)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--fg-faintest)",
            }}
          >
            OPEN A ROUND AT <span style={{ color: "var(--cyan)" }}>/ASK</span>
          </div>
        </div>
      </motion.div>
    );
  }

  // No live round — arena idle
  if (!loading && !liveRoundId) {
    return (
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
      >
        <div
          className="text-center min-w-[280px]"
          style={{
            background: "rgba(7,7,12,0.85)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-0)",
            padding: "14px 18px",
            backdropFilter: "blur(6px)",
          }}
        >
          <div className="t-label" style={{ color: "var(--fg-faint)" }}>
            ▸ ARENA IDLE
          </div>
          <div
            className="mt-1"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--t-mini)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--fg-faintest)",
            }}
          >
            ASK A QUESTION TO OPEN A ROUND →{" "}
            <span style={{ color: "var(--cyan)" }}>/ASK</span>
          </div>
        </div>
      </motion.div>
    );
  }

  // Live round — full center node
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
    >
      <div
        className="text-center min-w-[280px]"
        style={{
          background: "rgba(7,7,12,0.85)",
          border: "1px solid var(--cyan)",
          borderRadius: "var(--r-0)",
          padding: "14px 18px",
          boxShadow: "var(--halo-cyan)",
          backdropFilter: "blur(6px)",
        }}
      >
        <div className="t-label" style={{ color: "var(--cyan)" }}>
          ▸ LIVE ROUND
        </div>
        <div
          className="mt-1"
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: "var(--t-h2)",
            color: "var(--fg)",
            letterSpacing: "0.02em",
          }}
        >
          {liveTokenSymbol ? (
            <>
              buy or sell{" "}
              <span style={{ color: "var(--cyan)" }}>${liveTokenSymbol}</span>{" "}
              now?
            </>
          ) : (
            (liveQuestion ?? "buy or sell now?")
          )}
        </div>
        <div
          className="mt-2"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--t-mini)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--fg-faint)",
          }}
        >
          DEADLINE <span style={{ color: "var(--fg)" }}>{deadlineLabel}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function toNodeShape(a: ArenaAgent) {
  return {
    id: a.id,
    short_id: a.short_id,
    name: a.name,
    sharpe: a.sharpe ?? 0,
    last: a.last ?? ("hold" as const),
    pnl: a.pnl ?? 0,
  };
}

/** Returns "MM:SS" countdown to the deadline. Updates every second. */
function useDeadlineCountdown(deadlineAt?: string): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadlineAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadlineAt]);
  if (!deadlineAt) return "--:--";
  const diff = Math.max(0, Math.floor((Date.parse(deadlineAt) - now) / 1000));
  const mm = String(Math.floor(diff / 60)).padStart(2, "0");
  const ss = String(diff % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
