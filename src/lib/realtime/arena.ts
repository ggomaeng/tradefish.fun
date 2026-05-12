"use client";

import { useEffect, useReducer, useRef } from "react";
import { dbBrowser } from "@/lib/db";

// ─── Public hook shape ──────────────────────────────────────────────
export type AgentDirection = "buy" | "sell" | "hold";

export type ArenaAgent = {
  id: string; // uuid
  short_id: string; // ag_xxxx
  name: string;
  last?: AgentDirection;
  confidence?: number; // 0..1
  pnl?: number; // %
  sharpe?: number;
  // ISO timestamp of the agent's last poll (GET /pending) or response.
  // Drives the heartbeat dot on the swarm canvas: ≤30s = "thinking now",
  // ≤5min = "recently active", older = stale. Omit when unknown.
  last_seen_at?: string;
};

export type ArenaState = {
  agents: ArenaAgent[];
  liveRoundId?: string; // queries.id (uuid)
  liveRoundShortId?: string; // queries.short_id
  liveQuestion?: string; // "buy or sell $BONK now?"
  liveTokenSymbol?: string;
  liveDeadlineAt?: string; // ISO
  loading: boolean;
  error?: string;
};

function pnlPct(
  totalPnlUsd: number | null | undefined,
  bankrollUsd: number | null | undefined,
): number | undefined {
  if (totalPnlUsd == null || bankrollUsd == null || bankrollUsd === 0)
    return undefined;
  return (Number(totalPnlUsd) / Number(bankrollUsd)) * 100;
}

// ─── Reducer ────────────────────────────────────────────────────────
type Action =
  | { type: "init"; payload: Partial<ArenaState> }
  | {
      type: "merge_response";
      agentId: string;
      last: AgentDirection;
      confidence: number;
    }
  | {
      type: "merge_leaderboard";
      rows: Array<{
        agent_id: string;
        total_pnl_usd: number | null;
        bankroll_usd: number | null;
        sharpe: number | null;
      }>;
    }
  | { type: "error"; message: string };

function reducer(state: ArenaState, action: Action): ArenaState {
  switch (action.type) {
    case "init":
      return { ...state, ...action.payload, loading: false };
    case "merge_response":
      return {
        ...state,
        agents: state.agents.map((a) =>
          a.id === action.agentId
            ? { ...a, last: action.last, confidence: action.confidence }
            : a,
        ),
      };
    case "merge_leaderboard": {
      const byId = new Map(action.rows.map((r) => [r.agent_id, r]));
      return {
        ...state,
        agents: state.agents.map((a) => {
          const row = byId.get(a.id);
          if (!row) return a;
          return {
            ...a,
            pnl: pnlPct(row.total_pnl_usd, row.bankroll_usd) ?? a.pnl,
            sharpe: row.sharpe ?? a.sharpe,
          };
        }),
      };
    }
    case "error":
      return { ...state, error: action.message, loading: false };
  }
}

const INITIAL: ArenaState = { agents: [], loading: true };

// ─── Hook ───────────────────────────────────────────────────────────
export function useArenaSwarm(): ArenaState {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  // Avoid stale-closure: keep latest live round id for response handler
  const liveRoundIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const sb = dbBrowser();

    async function refetchLeaderboard(agentIds: string[]) {
      if (!agentIds.length) return;
      const { data: lb } = await sb
        .from("leaderboard")
        .select("agent_id,total_pnl_usd,bankroll_usd,sharpe")
        .in("agent_id", agentIds);
      if (cancelled || !lb) return;
      dispatch({
        type: "merge_leaderboard",
        rows: lb.map((r) => ({
          agent_id: r.agent_id as string,
          total_pnl_usd: r.total_pnl_usd as number | null,
          bankroll_usd: r.bankroll_usd as number | null,
          sharpe: r.sharpe as number | null,
        })),
      });
    }

    async function bootstrap() {
      try {
        // (a) most-recent open query (deadline in future), with token symbol
        const nowIso = new Date().toISOString();
        const { data: queryRows, error: queryErr } = await sb
          .from("queries")
          .select(
            "id,short_id,asked_at,deadline_at,token_mint,supported_tokens(symbol)",
          )
          .gt("deadline_at", nowIso)
          .order("asked_at", { ascending: false })
          .limit(1);
        if (queryErr) throw queryErr;

        const liveQuery = queryRows?.[0] as
          | {
              id: string;
              short_id: string;
              deadline_at: string;
              token_mint: string;
              supported_tokens:
                | { symbol: string }
                | { symbol: string }[]
                | null;
            }
          | undefined;
        const tokenJoin = liveQuery?.supported_tokens;
        const tokenSymbol = Array.isArray(tokenJoin)
          ? tokenJoin[0]?.symbol
          : tokenJoin?.symbol;

        liveRoundIdRef.current = liveQuery?.id;

        // (b) agents (limit 24)
        const { data: agentRows, error: agentErr } = await sb
          .from("agents")
          .select("id,short_id,name,last_seen_at")
          .order("created_at", { ascending: false })
          .limit(24);
        if (agentErr) throw agentErr;

        const agents: ArenaAgent[] = (agentRows ?? []).map((a) => ({
          id: a.id as string,
          short_id: a.short_id as string,
          name: a.name as string,
          last_seen_at: (a.last_seen_at as string | null) ?? undefined,
        }));

        // (c) leaderboard for those agents (post-0014: USD PnL + bankroll → derive %)
        let lbById = new Map<
          string,
          {
            total_pnl_usd: number | null;
            bankroll_usd: number | null;
            sharpe: number | null;
          }
        >();
        if (agents.length) {
          const { data: lb } = await sb
            .from("leaderboard")
            .select("agent_id,total_pnl_usd,bankroll_usd,sharpe")
            .in(
              "agent_id",
              agents.map((a) => a.id),
            );
          lbById = new Map(
            (lb ?? []).map((r) => [
              r.agent_id as string,
              {
                total_pnl_usd: r.total_pnl_usd as number | null,
                bankroll_usd: r.bankroll_usd as number | null,
                sharpe: r.sharpe as number | null,
              },
            ]),
          );
        }

        // (d) responses for the live round
        let respById = new Map<
          string,
          { answer: AgentDirection; confidence: number }
        >();
        if (liveQuery?.id) {
          const { data: resps } = await sb
            .from("responses")
            .select("agent_id,answer,confidence")
            .eq("query_id", liveQuery.id);
          respById = new Map(
            (resps ?? []).map((r) => [
              r.agent_id as string,
              {
                answer: r.answer as AgentDirection,
                confidence: Number(r.confidence),
              },
            ]),
          );
        }

        const merged: ArenaAgent[] = agents.map((a) => {
          const lb = lbById.get(a.id);
          const r = respById.get(a.id);
          return {
            ...a,
            pnl: pnlPct(lb?.total_pnl_usd, lb?.bankroll_usd),
            sharpe: lb?.sharpe ?? undefined,
            last: r?.answer,
            confidence: r?.confidence,
          };
        });

        if (cancelled) return;
        dispatch({
          type: "init",
          payload: {
            agents: merged,
            liveRoundId: liveQuery?.id,
            liveRoundShortId: liveQuery?.short_id,
            liveTokenSymbol: tokenSymbol,
            liveQuestion: tokenSymbol
              ? `buy or sell $${tokenSymbol} now?`
              : undefined,
            liveDeadlineAt: liveQuery?.deadline_at,
          },
        });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        dispatch({ type: "error", message: msg });
      }
    }

    bootstrap();

    // ─── Realtime channel ─────────────────────────────────────────
    const channel = sb
      .channel("arena")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "responses" },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new;
          if (!row) return;
          if (
            liveRoundIdRef.current &&
            row.query_id !== liveRoundIdRef.current
          ) {
            return;
          }
          dispatch({
            type: "merge_response",
            agentId: String(row.agent_id),
            last: row.answer as AgentDirection,
            confidence: Number(row.confidence),
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "paper_trades" },
        () => {
          // Cheap path: refetch leaderboard for the current agent set.
          // Snapshots dispatched IDs from latest state via closure.
          // NOTE: we read agent ids at refetch-time via a quick agents query
          // to avoid stale-closure on `state.agents`.
          (async () => {
            const { data: agentRows } = await sb
              .from("agents")
              .select("id")
              .limit(24);
            const ids = (agentRows ?? []).map((r) => r.id as string);
            await refetchLeaderboard(ids);
          })();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
