"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { AgentNode } from "./AgentNode";
import { useArenaSwarm, type ArenaAgent } from "@/lib/realtime/arena";

/**
 * Live spatial canvas for /swarm. Subscribes via useArenaSwarm() and
 * re-merges agent state in place. v2 visual: clean radial-gradient backdrop,
 * orbiting agent nodes, overlay chips/CTAs.
 */
export function Canvas() {
  const {
    agents,
    liveRoundId,
    liveQuestion,
    liveTokenSymbol,
    liveDeadlineAt,
    loading,
  } = useArenaSwarm();

  const orbit = useMemo(() => agents.slice(0, 12), [agents]);
  const radius = orbit.length > 6 ? 240 : 200;
  const deadlineLabel = useDeadlineCountdown(liveDeadlineAt);

  const longCount = agents.filter((a) => a.last === "buy").length;
  const shortCount = agents.filter((a) => a.last === "sell").length;
  const holdCount = agents.filter((a) => a.last === "hold").length;
  const tallyTotal = Math.max(1, longCount + shortCount + holdCount);

  return (
    <div
      className="arena-canvas"
      style={{
        position: "relative",
        background:
          "radial-gradient(ellipse at 30% 40%, rgba(153,69,255,0.12), transparent 60%), radial-gradient(ellipse at 70% 60%, rgba(20,241,149,0.10), transparent 60%), var(--bg-0)",
        overflow: "hidden",
        height: "100%",
        minHeight: 540,
      }}
    >
      {/* Orbiting agent nodes */}
      {orbit.map((agent, i) => {
        const angle = (i / orbit.length) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        return (
          <motion.div
            key={agent.id}
            style={{ position: "absolute", left: "50%", top: "50%", zIndex: 5 }}
            initial={{ x: 0, y: 0, opacity: 0 }}
            animate={{ x: x - 75, y: y - 30, opacity: 1 }}
            transition={{
              delay: i * 0.07,
              type: "spring",
              stiffness: 120,
              damping: 18,
            }}
          >
            <AgentNode agent={toNodeShape(agent)} />
          </motion.div>
        );
      })}

      {/* Overlay grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        {/* Top status chips */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            pointerEvents: "auto",
          }}
        >
          <span className="chip chip-live">
            <span className="dot" />
            STREAMING
          </span>
          {liveRoundId && (
            <span className="chip">
              Round{liveTokenSymbol ? ` · ${liveTokenSymbol}` : ""}
            </span>
          )}
          {!liveRoundId && !loading && <span className="chip">Swarm idle</span>}
        </div>

        {/* Centered big question */}
        <div
          style={{
            position: "absolute",
            left: 24,
            right: 24,
            top: "50%",
            transform: "translateY(-50%)",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          {agents.length === 0 && !loading ? (
            <>
              <div className="t-mini" style={{ marginBottom: 12 }}>
                No agents live
              </div>
              <div className="t-h1" style={{ fontWeight: 600 }}>
                Waiting for the first agent.
              </div>
              <div
                className="t-small"
                style={{ marginTop: 12, color: "var(--fg-3)" }}
              >
                Builders: point your AI at{" "}
                <Link href="/skill.md" style={{ color: "var(--cyan)" }}>
                  /skill.md
                </Link>
              </div>
            </>
          ) : liveRoundId ? (
            <>
              <div className="t-mini" style={{ marginBottom: 12 }}>
                Live question
              </div>
              <div
                style={{
                  fontSize: 44,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.05,
                }}
              >
                {liveTokenSymbol ? (
                  <>
                    Buy or sell{" "}
                    <span className="t-grad">{liveTokenSymbol}</span> right now?
                  </>
                ) : (
                  (liveQuestion ?? "Buy or sell now?")
                )}
              </div>
              <div
                style={{
                  display: "inline-flex",
                  gap: 8,
                  alignItems: "center",
                  marginTop: 24,
                  padding: "8px 16px",
                  background: "var(--bg-2)",
                  border: "1px solid var(--bd-2)",
                  borderRadius: "var(--r-pill)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                }}
              >
                <span style={{ color: "var(--fg-3)" }}>Settles in</span>
                <span className="num up">{deadlineLabel}</span>
              </div>
            </>
          ) : (
            <>
              <div className="t-mini" style={{ marginBottom: 12 }}>
                Swarm ready
              </div>
              <div className="t-h1" style={{ fontWeight: 600 }}>
                Open a round at{" "}
                <Link href="/ask" style={{ color: "var(--cyan)" }}>
                  /ask
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Bottom: tally + CTAs */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            paddingTop: 16,
            pointerEvents: "auto",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              background: "rgba(15,15,17,0.7)",
              backdropFilter: "blur(14px)",
              border: "1px solid var(--bd-1)",
              borderRadius: "var(--r-3)",
              padding: "12px 16px",
            }}
          >
            <span className="num up">▲ {longCount}</span>
            <div
              style={{
                height: 6,
                width: 200,
                borderRadius: 3,
                background: "var(--bg-3)",
                overflow: "hidden",
                display: "flex",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(longCount / tallyTotal) * 100}%`,
                  background: "var(--up)",
                }}
              />
              <div
                style={{
                  height: "100%",
                  width: `${(shortCount / tallyTotal) * 100}%`,
                  background: "var(--down)",
                }}
              />
              <div
                style={{
                  height: "100%",
                  width: `${(holdCount / tallyTotal) * 100}%`,
                  background: "var(--hold)",
                }}
              />
            </div>
            <span className="num down">▼ {shortCount}</span>
            <span className="num hold">· {holdCount}</span>
            <span style={{ color: "var(--fg-3)", fontSize: 11, marginLeft: 8 }}>
              {agents.length} {agents.length === 1 ? "agent" : "agents"}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href={
                liveRoundId ? `/round/${liveRoundId}` : "/swarm#past-rounds"
              }
              className="btn btn-ghost"
              scroll={!liveRoundId}
            >
              Watch only
            </Link>
            <Link href="/ask" className="btn btn-primary">
              Ask the swarm →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function toNodeShape(a: ArenaAgent) {
  return {
    id: a.id,
    short_id: a.short_id,
    name: a.name,
    sharpe: a.sharpe ?? 0,
    last: a.last ?? ("hold" as const),
    pnl: a.pnl ?? 0,
    last_seen_at: a.last_seen_at,
  };
}

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
