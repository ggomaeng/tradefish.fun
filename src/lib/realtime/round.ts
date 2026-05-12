"use client";

/**
 * useRoundActivity — Realtime hook for a single round page.
 *
 * Bootstrap: SSR page hands initial responses + settlements as props.
 * This hook subscribes to INSERTs on `responses` (filtered to queryId)
 * and `settlements` (fetched via response_id join on event).
 *
 * Exposes merged { responses, settlements } that the client sidebar can
 * render incrementally without a full page refresh.
 */

import { useEffect, useReducer, useRef } from "react";
import { dbBrowser } from "@/lib/db";

export type RoundResponse = {
  id: string;
  agent_id: string;
  answer: "buy" | "sell" | "hold";
  confidence: number;
  reasoning: string | null;
  responded_at: string;
  pyth_price_at_response: number;
  agent_name: string;
  agent_short_id: string;
};

export type RoundSettlement = {
  response_id: string;
  horizon: "1h" | "4h" | "24h";
  pnl_pct: number;
  pyth_price_at_settle: number;
  direction_correct: boolean;
  settled_at: string;
};

type RoundActivityState = {
  responses: RoundResponse[];
  settlements: RoundSettlement[];
  loading: boolean;
};

type Action =
  | { type: "init"; responses: RoundResponse[]; settlements: RoundSettlement[] }
  | { type: "add_response"; response: RoundResponse }
  | { type: "add_settlement"; settlement: RoundSettlement };

function reducer(state: RoundActivityState, action: Action): RoundActivityState {
  switch (action.type) {
    case "init":
      return { ...state, responses: action.responses, settlements: action.settlements, loading: false };
    case "add_response":
      if (state.responses.find((r) => r.id === action.response.id)) return state;
      return { ...state, responses: [...state.responses, action.response] };
    case "add_settlement":
      if (state.settlements.find((s) => s.response_id === action.settlement.response_id && s.horizon === action.settlement.horizon)) return state;
      return { ...state, settlements: [...state.settlements, action.settlement] };
  }
}

export function useRoundActivity(
  queryId: string,
  initialResponses: RoundResponse[],
  initialSettlements: RoundSettlement[],
): RoundActivityState {
  const [state, dispatch] = useReducer(reducer, {
    responses: initialResponses,
    settlements: initialSettlements,
    loading: false,
  });

  // Track known response IDs for settlement subscriptions
  const responseIdsRef = useRef<Set<string>>(new Set(initialResponses.map((r) => r.id)));

  useEffect(() => {
    // Sync responseIdsRef with current responses
    for (const r of state.responses) {
      responseIdsRef.current.add(r.id);
    }
  }, [state.responses]);

  useEffect(() => {
    let cancelled = false;
    const sb = dbBrowser();

    const channel = sb
      .channel(`round-${queryId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "responses",
          filter: `query_id=eq.${queryId}`,
        },
        async (payload: { new: Record<string, unknown> }) => {
          const row = payload.new;
          if (!row?.id || cancelled) return;
          // Fetch enriched row with agent join
          const { data } = await sb
            .from("responses")
            .select("id, agent_id, answer, confidence, reasoning, responded_at, pyth_price_at_response, agents!inner(short_id, name)")
            .eq("id", String(row.id))
            .single();
          if (!data || cancelled) return;
          const d = data as {
            id: string;
            agent_id: string;
            answer: "buy" | "sell" | "hold";
            confidence: number | string;
            reasoning: string | null;
            responded_at: string;
            pyth_price_at_response: number | string;
            agents: { short_id: string; name: string } | { short_id: string; name: string }[] | null;
          };
          const ag = Array.isArray(d.agents) ? d.agents[0] : d.agents;
          if (!ag) return;
          responseIdsRef.current.add(d.id);
          dispatch({
            type: "add_response",
            response: {
              id: d.id,
              agent_id: d.agent_id,
              answer: d.answer,
              confidence: Number(d.confidence),
              reasoning: d.reasoning,
              responded_at: d.responded_at,
              pyth_price_at_response: Number(d.pyth_price_at_response),
              agent_name: ag.name,
              agent_short_id: ag.short_id,
            },
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "settlements",
        },
        async (payload: { new: Record<string, unknown> }) => {
          const row = payload.new;
          if (!row?.response_id || cancelled) return;
          // Only process if this settlement is for a response we know about
          if (!responseIdsRef.current.has(String(row.response_id))) return;
          dispatch({
            type: "add_settlement",
            settlement: {
              response_id: String(row.response_id),
              horizon: row.horizon as "1h" | "4h" | "24h",
              pnl_pct: Number(row.pnl_pct),
              pyth_price_at_settle: Number(row.pyth_price_at_settle),
              direction_correct: Boolean(row.direction_correct),
              settled_at: String(row.settled_at),
            },
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      channel.unsubscribe();
    };
  }, [queryId]);

  return state;
}
