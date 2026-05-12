"use client";

import Link from "next/link";

type Props = {
  agent: {
    id: string;
    short_id?: string;
    name: string;
    sharpe: number;
    last: "buy" | "sell" | "hold";
    pnl: number;
    /** ISO timestamp of last poll or response — drives the heartbeat dot. */
    last_seen_at?: string;
  };
};

/**
 * Map `last_seen_at` to a discrete heartbeat state.
 *   - "live"  : seen within HEARTBEAT_LIVE_MS — green pulsing dot.
 *   - "warm"  : seen within HEARTBEAT_WARM_MS — green static dot.
 *   - "cold"  : seen but stale — dim grey dot.
 *   - "never" : no last_seen — no dot.
 *
 * Why the live tier exists: agents poll /pending or post a response every
 * ~10s. Anything within 30s == "currently thinking" and gets a visible
 * pulse so the swarm canvas reads as a living board during demos.
 */
const HEARTBEAT_LIVE_MS = 30 * 1000;
const HEARTBEAT_WARM_MS = 5 * 60 * 1000;

function heartbeatState(
  lastSeenAt: string | undefined,
): "live" | "warm" | "cold" | "never" {
  if (!lastSeenAt) return "never";
  const ageMs = Date.now() - new Date(lastSeenAt).getTime();
  if (Number.isNaN(ageMs) || ageMs < 0) return "never";
  if (ageMs <= HEARTBEAT_LIVE_MS) return "live";
  if (ageMs <= HEARTBEAT_WARM_MS) return "warm";
  return "cold";
}

const DIR_BORDER: Record<Props["agent"]["last"], string> = {
  buy: "var(--up-bd)",
  sell: "var(--down-bd)",
  hold: "var(--bd-2)",
};
const DIR_BG: Record<Props["agent"]["last"], string> = {
  buy: "var(--up-bg)",
  sell: "var(--down-bg)",
  hold: "var(--bg-2)",
};
const DIR_LABEL: Record<Props["agent"]["last"], string> = {
  buy: "▲ LONG",
  sell: "▼ SHORT",
  hold: "· HOLD",
};
const DIR_COLOR: Record<Props["agent"]["last"], string> = {
  buy: "var(--up)",
  sell: "var(--down)",
  hold: "var(--hold)",
};

export function AgentNode({ agent }: Props) {
  const border = DIR_BORDER[agent.last];
  const bg = DIR_BG[agent.last];
  const hb = heartbeatState(agent.last_seen_at);
  const hbColor =
    hb === "live"
      ? "var(--up)"
      : hb === "warm"
        ? "var(--up)"
        : hb === "cold"
          ? "var(--fg-4)"
          : "transparent";
  const hbTitle =
    hb === "live"
      ? "Active — last poll <30s ago"
      : hb === "warm"
        ? "Recently active — last poll <5min ago"
        : hb === "cold"
          ? "Idle — last poll >5min ago"
          : "Never polled";
  return (
    <Link
      href={`/agents/${agent.short_id ?? agent.id}`}
      style={{
        position: "relative",
        display: "block",
        width: 150,
        background: "rgba(15,15,17,0.85)",
        border: `1px solid ${border}`,
        borderRadius: "var(--r-3)",
        padding: "10px 12px",
        backdropFilter: "blur(6px)",
        textDecoration: "none",
        transition: "border-color 120ms, transform 120ms",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      }}
    >
      {/* Heartbeat dot — top-right corner. Pulses (CSS) when "live" so
          you can see at a glance which agents are actively polling /
          thinking during a round. */}
      {hb !== "never" && (
        <span
          aria-label={hbTitle}
          title={hbTitle}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: hbColor,
            boxShadow:
              hb === "live"
                ? `0 0 8px ${hbColor}, 0 0 14px ${hbColor}`
                : "none",
            animation: hb === "live" ? "tfHeartbeat 1.4s infinite" : "none",
          }}
        />
      )}
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--fg)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          paddingRight: hb !== "never" ? 14 : 0,
        }}
      >
        {agent.name}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 6,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            padding: "2px 6px",
            background: bg,
            borderRadius: "var(--r-1)",
            color: DIR_COLOR[agent.last],
          }}
        >
          {DIR_LABEL[agent.last]}
        </span>
        <span
          title="rolling PnL %"
          className="num"
          style={{
            fontSize: 12,
            color: agent.pnl >= 0 ? "var(--up)" : "var(--down)",
          }}
        >
          {agent.pnl >= 0 ? "+" : ""}
          {agent.pnl.toFixed(2)}%
        </span>
      </div>
      <div
        style={{
          marginTop: 4,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--fg-3)",
        }}
      >
        Sharpe{" "}
        <span style={{ color: "var(--fg-2)" }}>{agent.sharpe.toFixed(2)}</span>
      </div>
    </Link>
  );
}
