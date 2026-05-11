"use client";

/**
 * useArenaActivity — small Realtime hook that backs <LiveActivity />.
 *
 * Bootstrap: pulls the last 8 events from a UNION of:
 *   - latest 8 responses (joined to agents)
 *   - latest 4 settlements (joined to responses → agents)
 *   - latest 2 newly-claimed agents
 * Sorted by event timestamp desc and trimmed to 8.
 *
 * Realtime: subscribes to the `activity` channel for INSERTs on `responses`
 * and `settlements` and prepends new events. Trims the buffer to 8.
 *
 * NOTE: claim events come only from the bootstrap fetch — there's no good
 * INSERT trigger for them since claim toggles `agents.claimed = true` via
 * UPDATE. We refetch claims on settle/respond ticks to keep things fresh
 * without subscribing to all agent updates.
 */

import { useEffect, useRef, useState } from "react";
import { dbBrowser } from "@/lib/db";

export type ActivityEvent =
  | {
      kind: "predict";
      ts: string;
      who: string;
      token: string;
      dir: "buy" | "sell" | "hold";
      conf: number;
    }
  | {
      kind: "settle";
      ts: string;
      who: string;
      token: string;
      dir: "buy" | "sell" | "hold";
      pnl: number;
      horizon: "1h" | "4h" | "24h";
    }
  | { kind: "claim"; ts: string; who: string };

const MAX_EVENTS = 8;

function evTimestamp(e: ActivityEvent): number {
  return new Date(e.ts).getTime();
}

function dedupeKey(e: ActivityEvent): string {
  if (e.kind === "predict") return `p:${e.who}:${e.token}:${e.ts}`;
  if (e.kind === "settle") return `s:${e.who}:${e.token}:${e.horizon}:${e.ts}`;
  return `c:${e.who}:${e.ts}`;
}

function trimAndSort(events: ActivityEvent[]): ActivityEvent[] {
  const seen = new Set<string>();
  const out: ActivityEvent[] = [];
  for (const e of events) {
    const k = dedupeKey(e);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  out.sort((a, b) => evTimestamp(b) - evTimestamp(a));
  return out.slice(0, MAX_EVENTS);
}

export function useArenaActivity(): {
  events: ActivityEvent[];
  loading: boolean;
} {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const eventsRef = useRef<ActivityEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    const sb = dbBrowser();

    function commit(next: ActivityEvent[]) {
      const trimmed = trimAndSort(next);
      eventsRef.current = trimmed;
      setEvents(trimmed);
    }

    async function bootstrap() {
      try {
        // (a) latest 8 responses, joined to agents + supported_tokens.
        const respPromise = sb
          .from("responses")
          .select(
            "id, answer, confidence, responded_at, agents(name), queries(token_mint, supported_tokens(symbol))",
          )
          .order("responded_at", { ascending: false })
          .limit(8);

        // (b) latest 4 settlements, joined to response → agent + token.
        const settlePromise = sb
          .from("settlements")
          .select(
            "horizon, pnl_pct, settled_at, response_id, responses(answer, agents(name), queries(supported_tokens(symbol)))",
          )
          .order("settled_at", { ascending: false })
          .limit(4);

        // (c) latest 2 claimed agents (no claimed_at column, fall back to
        //     last_seen_at as the closest stand-in).
        const claimPromise = sb
          .from("agents")
          .select("name, last_seen_at, created_at")
          .eq("claimed", true)
          .order("created_at", { ascending: false })
          .limit(2);

        const [respRes, settleRes, claimRes] = await Promise.all([
          respPromise,
          settlePromise,
          claimPromise,
        ]);

        const collected: ActivityEvent[] = [];

        for (const r of respRes.data ?? []) {
          const row = r as {
            answer: "buy" | "sell" | "hold";
            confidence: number | string;
            responded_at: string;
            agents:
              | { name: string }
              | { name: string }[]
              | null;
            queries:
              | {
                  token_mint: string;
                  supported_tokens:
                    | { symbol: string }
                    | { symbol: string }[]
                    | null;
                }
              | {
                  token_mint: string;
                  supported_tokens:
                    | { symbol: string }
                    | { symbol: string }[]
                    | null;
                }[]
              | null;
          };
          const agentJoin = row.agents;
          const who = Array.isArray(agentJoin)
            ? agentJoin[0]?.name
            : agentJoin?.name;
          const queryJoin = Array.isArray(row.queries)
            ? row.queries[0]
            : row.queries;
          const tokJoin = queryJoin?.supported_tokens;
          const tok = Array.isArray(tokJoin) ? tokJoin[0]?.symbol : tokJoin?.symbol;
          if (!who || !tok) continue;
          collected.push({
            kind: "predict",
            ts: row.responded_at,
            who,
            token: tok,
            dir: row.answer,
            conf: Number(row.confidence),
          });
        }

        for (const s of settleRes.data ?? []) {
          const row = s as {
            horizon: "1h" | "4h" | "24h";
            pnl_pct: number | string;
            settled_at: string;
            responses:
              | {
                  answer: "buy" | "sell" | "hold";
                  agents: { name: string } | { name: string }[] | null;
                  queries:
                    | {
                        supported_tokens:
                          | { symbol: string }
                          | { symbol: string }[]
                          | null;
                      }
                    | {
                        supported_tokens:
                          | { symbol: string }
                          | { symbol: string }[]
                          | null;
                      }[]
                    | null;
                }
              | {
                  answer: "buy" | "sell" | "hold";
                  agents: { name: string } | { name: string }[] | null;
                  queries:
                    | {
                        supported_tokens:
                          | { symbol: string }
                          | { symbol: string }[]
                          | null;
                      }
                    | {
                        supported_tokens:
                          | { symbol: string }
                          | { symbol: string }[]
                          | null;
                      }[]
                    | null;
                }[]
              | null;
          };
          const respJoin = Array.isArray(row.responses)
            ? row.responses[0]
            : row.responses;
          if (!respJoin) continue;
          const ag = respJoin.agents;
          const who = Array.isArray(ag) ? ag[0]?.name : ag?.name;
          const qJoin = Array.isArray(respJoin.queries)
            ? respJoin.queries[0]
            : respJoin.queries;
          const tokJoin = qJoin?.supported_tokens;
          const tok = Array.isArray(tokJoin)
            ? tokJoin[0]?.symbol
            : tokJoin?.symbol;
          if (!who || !tok) continue;
          collected.push({
            kind: "settle",
            ts: row.settled_at,
            who,
            token: tok,
            dir: respJoin.answer,
            pnl: Number(row.pnl_pct),
            horizon: row.horizon,
          });
        }

        for (const c of claimRes.data ?? []) {
          const row = c as {
            name: string;
            last_seen_at: string | null;
            created_at: string;
          };
          collected.push({
            kind: "claim",
            ts: row.last_seen_at ?? row.created_at,
            who: row.name,
          });
        }

        if (cancelled) return;
        commit(collected);
      } catch {
        if (!cancelled) commit([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();

    // ─── Realtime channel ─────────────────────────────────────────
    // INSERTs on responses + settlements give us new predict/settle events.
    // For settle events we need joined data (agent name, token symbol) that
    // postgres_changes won't provide — fetch it lazily before prepending.
    const channel = sb
      .channel("activity")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "responses" },
        async (payload: { new: Record<string, unknown> }) => {
          const row = payload.new;
          if (!row?.id) return;
          const { data } = await sb
            .from("responses")
            .select(
              "answer, confidence, responded_at, agents(name), queries(supported_tokens(symbol))",
            )
            .eq("id", String(row.id))
            .single();
          if (!data) return;
          const r = data as {
            answer: "buy" | "sell" | "hold";
            confidence: number | string;
            responded_at: string;
            agents: { name: string } | { name: string }[] | null;
            queries:
              | {
                  supported_tokens:
                    | { symbol: string }
                    | { symbol: string }[]
                    | null;
                }
              | {
                  supported_tokens:
                    | { symbol: string }
                    | { symbol: string }[]
                    | null;
                }[]
              | null;
          };
          const ag = r.agents;
          const who = Array.isArray(ag) ? ag[0]?.name : ag?.name;
          const qJoin = Array.isArray(r.queries) ? r.queries[0] : r.queries;
          const tokJoin = qJoin?.supported_tokens;
          const tok = Array.isArray(tokJoin)
            ? tokJoin[0]?.symbol
            : tokJoin?.symbol;
          if (!who || !tok) return;
          const ev: ActivityEvent = {
            kind: "predict",
            ts: r.responded_at,
            who,
            token: tok,
            dir: r.answer,
            conf: Number(r.confidence),
          };
          commit([ev, ...eventsRef.current]);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "settlements" },
        async (payload: { new: Record<string, unknown> }) => {
          const row = payload.new;
          if (!row?.response_id) return;
          const { data } = await sb
            .from("responses")
            .select(
              "answer, agents(name), queries(supported_tokens(symbol))",
            )
            .eq("id", String(row.response_id))
            .single();
          if (!data) return;
          const r = data as {
            answer: "buy" | "sell" | "hold";
            agents: { name: string } | { name: string }[] | null;
            queries:
              | {
                  supported_tokens:
                    | { symbol: string }
                    | { symbol: string }[]
                    | null;
                }
              | {
                  supported_tokens:
                    | { symbol: string }
                    | { symbol: string }[]
                    | null;
                }[]
              | null;
          };
          const ag = r.agents;
          const who = Array.isArray(ag) ? ag[0]?.name : ag?.name;
          const qJoin = Array.isArray(r.queries) ? r.queries[0] : r.queries;
          const tokJoin = qJoin?.supported_tokens;
          const tok = Array.isArray(tokJoin)
            ? tokJoin[0]?.symbol
            : tokJoin?.symbol;
          if (!who || !tok) return;
          const ev: ActivityEvent = {
            kind: "settle",
            ts: String(row.settled_at ?? new Date().toISOString()),
            who,
            token: tok,
            dir: r.answer,
            pnl: Number(row.pnl_pct),
            horizon: row.horizon as "1h" | "4h" | "24h",
          };
          commit([ev, ...eventsRef.current]);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      channel.unsubscribe();
    };
  }, []);

  return { events, loading };
}

// ─── Helpers (also used by LiveActivity for rendering) ──────────────

export function relativeTime(iso: string, nowMs: number = Date.now()): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, nowMs - t);
  if (diff < 5_000) return "now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
