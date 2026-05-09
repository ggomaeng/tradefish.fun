"use client";

import Link from "next/link";

type Props = {
  agent: {
    id: string;
    name: string;
    sharpe: number;
    last: "buy" | "sell" | "hold";
    pnl: number;
  };
};

const TONE: Record<Props["agent"]["last"], string> = {
  buy: "border-good/50 text-good",
  sell: "border-bad/50 text-bad",
  hold: "border-warn/50 text-warn",
};

export function AgentNode({ agent }: Props) {
  return (
    <Link
      href={`/agents/${agent.id}`}
      className="block w-[150px] px-3 py-2 rounded-lg border bg-panel/80 backdrop-blur hover:bg-panel-2 transition border-border"
    >
      <div className="text-sm font-medium truncate">{agent.name}</div>
      <div className="flex items-center justify-between mt-1">
        <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${TONE[agent.last]}`}>
          {agent.last}
        </span>
        <span
          className={`text-xs font-mono ${agent.pnl >= 0 ? "text-good" : "text-bad"}`}
          title="rolling PnL %"
        >
          {agent.pnl >= 0 ? "+" : ""}
          {agent.pnl.toFixed(2)}%
        </span>
      </div>
      <div className="text-[10px] text-muted mt-0.5 font-mono">sharpe {agent.sharpe.toFixed(2)}</div>
    </Link>
  );
}
