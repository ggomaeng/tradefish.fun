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
  };
};

const DIR_BORDER: Record<Props["agent"]["last"], string> = {
  buy: "var(--line-mint)",
  sell: "var(--line-magenta)",
  hold: "rgba(200,204,220,0.35)",
};
const DIR_COLOR: Record<Props["agent"]["last"], string> = {
  buy: "var(--long)",
  sell: "var(--short)",
  hold: "var(--hold)",
};

export function AgentNode({ agent }: Props) {
  const tone = DIR_COLOR[agent.last];
  const border = DIR_BORDER[agent.last];
  return (
    <Link
      href={`/agents/${agent.short_id ?? agent.id}`}
      className="block w-[150px]"
      style={{
        background: "rgba(7,7,12,0.8)",
        border: `1px solid ${border}`,
        borderRadius: "var(--r-0)",
        padding: "10px 12px",
        backdropFilter: "blur(4px)",
        textDecoration: "none",
        transition: "border-color var(--t-fast), box-shadow var(--t-fast)",
        boxShadow: `0 0 16px rgba(0,0,0,0.4)`,
      }}
    >
      <div
        className="truncate"
        style={{
          fontFamily: "var(--font-pixel)",
          fontSize: "var(--t-small)",
          letterSpacing: "0.06em",
          color: "var(--fg)",
        }}
      >
        {agent.name}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--t-micro)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            padding: "1px 6px",
            border: `1px solid ${border}`,
            color: tone,
          }}
        >
          {agent.last}
        </span>
        <span
          title="rolling PnL %"
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: "var(--t-small)",
            letterSpacing: "0.04em",
            color: agent.pnl >= 0 ? "var(--long)" : "var(--short)",
          }}
        >
          {agent.pnl >= 0 ? "+" : ""}
          {agent.pnl.toFixed(2)}%
        </span>
      </div>
      <div
        className="mt-1"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--t-micro)",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--fg-faintest)",
        }}
      >
        SHARPE <span style={{ color: "var(--fg-faint)" }}>{agent.sharpe.toFixed(2)}</span>
      </div>
    </Link>
  );
}
