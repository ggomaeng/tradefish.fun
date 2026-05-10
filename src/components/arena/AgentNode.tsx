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
  return (
    <Link
      href={`/agents/${agent.short_id ?? agent.id}`}
      style={{
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
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--fg)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {agent.name}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
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
          style={{ fontSize: 12, color: agent.pnl >= 0 ? "var(--up)" : "var(--down)" }}
        >
          {agent.pnl >= 0 ? "+" : ""}
          {agent.pnl.toFixed(2)}%
        </span>
      </div>
      <div style={{ marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>
        Sharpe <span style={{ color: "var(--fg-2)" }}>{agent.sharpe.toFixed(2)}</span>
      </div>
    </Link>
  );
}
