"use client";

/**
 * useRoundActivity — Realtime hook for a single round page.
 *
 * Bootstrap: SSR page hands initial responses + paper_trades + comments as props.
 * This hook subscribes to INSERTs on `responses` (filtered to queryId),
 * `paper_trades` (filtered to queryId), and `comments` (filtered to query_id
 * via responses join — we filter client-side since comments don't have a
 * direct query_id column).
 *
 * Exposes merged { responses, paperTrades, comments } for the client sidebar.
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
  position_size_usd: number;
  agent_name: string;
  agent_short_id: string;
};

export type RoundComment = {
  id: string;
  response_id: string;
  body: string;
  created_at: string;
  direction: "buy" | "sell" | "hold" | null;
  confidence: number | null;
  position_size_usd: number | null;
  entry_price: number | null;
  agent_name: string;
  agent_short_id: string;
};

export type RoundPaperTrade = {
  id: string;
  response_id: string | null;
  comment_id: string | null;
  agent_id: string;
  query_id: string;
  direction: "buy" | "sell" | "hold";
  position_size_usd: number;
  entry_price: number;
  exit_price: number;
  pnl_usd: number;
  settled_at: string;
  agent_name: string;
  agent_short_id: string;
};

// Keep legacy export for any remaining import sites — empty placeholder
/** @deprecated use RoundPaperTrade */
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
  paperTrades: RoundPaperTrade[];
  comments: RoundComment[];
  loading: boolean;
};

type Action =
  | { type: "init"; responses: RoundResponse[]; paperTrades: RoundPaperTrade[]; comments: RoundComment[] }
  | { type: "add_response"; response: RoundResponse }
  | { type: "add_paper_trade"; trade: RoundPaperTrade }
  | { type: "add_comment"; comment: RoundComment };

function reducer(state: RoundActivityState, action: Action): RoundActivityState {
  switch (action.type) {
    case "init":
      return { ...state, responses: action.responses, paperTrades: action.paperTrades, comments: action.comments, loading: false };
    case "add_response":
      if (state.responses.find((r) => r.id === action.response.id)) return state;
      return { ...state, responses: [...state.responses, action.response] };
    case "add_paper_trade":
      if (state.paperTrades.find((t) => t.id === action.trade.id)) return state;
      return { ...state, paperTrades: [...state.paperTrades, action.trade] };
    case "add_comment":
      if (state.comments.find((c) => c.id === action.comment.id)) return state;
      return { ...state, comments: [...state.comments, action.comment] };
  }
}

export function useRoundActivity(
  queryId: string,
  initialResponses: RoundResponse[],
  initialPaperTrades: RoundPaperTrade[],
  initialComments: RoundComment[],
): RoundActivityState {
  const [state, dispatch] = useReducer(reducer, {
    responses: initialResponses,
    paperTrades: initialPaperTrades,
    comments: initialComments,
    loading: false,
  });

  // Track known response IDs for comment/trade subscriptions
  const responseIdsRef = useRef<Set<string>>(new Set(initialResponses.map((r) => r.id)));

  useEffect(() => {
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
          const { data } = await sb
            .from("responses")
            .select("id, agent_id, answer, confidence, reasoning, responded_at, pyth_price_at_response, position_size_usd, agents!inner(short_id, name)")
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
            position_size_usd: number | string;
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
              position_size_usd: Number(d.position_size_usd ?? 100),
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
          table: "paper_trades",
          filter: `query_id=eq.${queryId}`,
        },
        async (payload: { new: Record<string, unknown> }) => {
          const row = payload.new;
          if (!row?.id || cancelled) return;
          // Fetch enriched row with agent join
          const { data } = await sb
            .from("paper_trades")
            .select("id, response_id, comment_id, agent_id, query_id, direction, position_size_usd, entry_price, exit_price, pnl_usd, settled_at, agents!inner(short_id, name)")
            .eq("id", String(row.id))
            .single();
          if (!data || cancelled) return;
          const d = data as {
            id: string;
            response_id: string | null;
            comment_id: string | null;
            agent_id: string;
            query_id: string;
            direction: "buy" | "sell" | "hold";
            position_size_usd: number | string;
            entry_price: number | string;
            exit_price: number | string;
            pnl_usd: number | string;
            settled_at: string;
            agents: { short_id: string; name: string } | { short_id: string; name: string }[] | null;
          };
          const ag = Array.isArray(d.agents) ? d.agents[0] : d.agents;
          if (!ag) return;
          dispatch({
            type: "add_paper_trade",
            trade: {
              id: d.id,
              response_id: d.response_id,
              comment_id: d.comment_id,
              agent_id: d.agent_id,
              query_id: d.query_id,
              direction: d.direction,
              position_size_usd: Number(d.position_size_usd),
              entry_price: Number(d.entry_price),
              exit_price: Number(d.exit_price),
              pnl_usd: Number(d.pnl_usd),
              settled_at: d.settled_at,
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
          table: "comments",
        },
        async (payload: { new: Record<string, unknown> }) => {
          const row = payload.new;
          if (!row?.id || cancelled) return;
          // Fetch enriched comment with agent join (via response → agent)
          const { data } = await sb
            .from("comments")
            .select("id, response_id, body, created_at, direction, confidence, position_size_usd, entry_price, responses!inner(agent_id, agents!inner(short_id, name), query_id)")
            .eq("id", String(row.id))
            .single();
          if (!data || cancelled) return;
          const d = data as {
            id: string;
            response_id: string;
            body: string;
            created_at: string;
            direction: "buy" | "sell" | "hold" | null;
            confidence: number | string | null;
            position_size_usd: number | string | null;
            entry_price: number | string | null;
            responses: {
              agent_id: string;
              query_id: string;
              agents: { short_id: string; name: string } | { short_id: string; name: string }[] | null;
            } | {
              agent_id: string;
              query_id: string;
              agents: { short_id: string; name: string } | { short_id: string; name: string }[] | null;
            }[] | null;
          };
          const respJoin = Array.isArray(d.responses) ? d.responses[0] : d.responses;
          if (!respJoin) return;
          // Only process if it belongs to our query
          if (respJoin.query_id !== queryId) return;
          const ag = Array.isArray(respJoin.agents) ? respJoin.agents[0] : respJoin.agents;
          if (!ag) return;
          dispatch({
            type: "add_comment",
            comment: {
              id: d.id,
              response_id: d.response_id,
              body: d.body,
              created_at: d.created_at,
              direction: d.direction,
              confidence: d.confidence !== null ? Number(d.confidence) : null,
              position_size_usd: d.position_size_usd !== null ? Number(d.position_size_usd) : null,
              entry_price: d.entry_price !== null ? Number(d.entry_price) : null,
              agent_name: ag.name,
              agent_short_id: ag.short_id,
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
