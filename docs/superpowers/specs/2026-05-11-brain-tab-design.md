# Brain — agent-shared knowledge graph

**Status:** Approved 2026-05-11. Implementation begins via `/loop` orchestration.
**Owner:** Lead session (orchestration) + dispatched subagents per surface.

## What we're building

A `/brain` tab on tradefish-platform that visualizes the agent-shared knowledge graph in real time: every settled round becomes a "lesson" (wiki entry), distilled by an external scholar agent (Hermes), embedded, deduplicated, and inserted into a Cosmograph-powered WebGL graph view. Edge brightness encodes profit-and-loss flow through cited notes. Agents on the platform consult this brain before answering, and the graph shows which notes drove which decisions.

Inspired by Karpathy's agent-OS gist and Obsidian's graph view, but **market-priced** — edges glow with USD PnL flow rather than mere co-occurrence.

## Goals

1. Make agent knowledge visible and growing in real time — a node materializes within ~30s of a round settling.
2. Differentiate from "another Obsidian clone" with PnL-weighted edges, retrieval replay, and time-lapse scrubbing.
3. Stay performant at 10k+ nodes via Cosmograph (WebGL) and pre-materialized adjacency.
4. Re-use the existing agent contract — Hermes is just another agent with a new role (scholar), no platform-internal LLM call.

## Non-goals (v1)

- Agent-to-agent edges ("Hermes cited Claude's note")
- Per-builder private brains (federation)
- Multi-version note history / edit timeline
- Human contributor UX (markdown editor in-app)
- Cross-platform export

## Decisions (locked)

| Axis | Decision |
| --- | --- |
| Scope | Viewer + auto-ingest |
| Entities visible by default | Notes + tokens (rounds/agents on click) |
| Wow features | Live ingestion · PnL-weighted edges · Retrieval replay · Time-lapse + neuron pulse |
| Citation capture | Hybrid — server logs every `/api/wiki/search`; agents may declare `cited_slugs` in answer POST for 2× weight |
| Distillation | External scholar agent (Hermes via cron) → `POST /api/brain/ingest` → server-side embed + dedup |
| UI layout | 60/40 split — Cosmograph graph on the left, live side panel (top tokens, ingestion feed, agent activity) on the right |
| Renderer | Cosmograph (GPU/WebGL) |
| Realtime | Supabase Realtime on `wiki_entries`, `note_edges`, `answer_citations` |
| Integration | Bolt-on (additive) — new tables, new endpoints, light references on existing pages |

## Data model — migration `0010_brain.sql`

### 1. Extend `wiki_entries`

```sql
alter table wiki_entries
  add column author_agent_id uuid references agents(id),
  add column source_round_id uuid references rounds(id),
  add column tokens text[] default '{}',
  add column pnl_attributed_usd numeric default 0,
  add column cite_count int default 0,
  add column created_at timestamptz default now();

create index if not exists wiki_entries_tokens_gin on wiki_entries using gin (tokens);
create index if not exists wiki_entries_created_at on wiki_entries (created_at desc);
```

Hand-authored notes leave `author_agent_id` null and `source_round_id` null. Scholar-authored notes set both.

### 2. `agent_retrievals` — search log (for retrieval replay)

```sql
create table agent_retrievals (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid references agents(id) on delete set null,
  query_text text not null,
  slugs text[] not null,
  created_at timestamptz default now()
);
create index on agent_retrievals (agent_id, created_at desc);
```

`id` is the `retrieval_id` returned to agents from `/api/wiki/search` so they may echo it back in their answer.

### 3. `answer_citations` — links answers ↔ notes

```sql
create table answer_citations (
  answer_id uuid references answers(id) on delete cascade,
  slug text references wiki_entries(slug) on delete cascade,
  source text not null check (source in ('retrieved','explicit')),
  weight numeric not null,
  primary key (answer_id, slug)
);
create index on answer_citations (slug);
```

Insertion rules (server-side, in `POST /api/queries/:id/respond`):
- If agent included `retrieval_id` → bulk-insert (`source='retrieved'`, `weight=1.0`) for every slug in `agent_retrievals.slugs`.
- If agent included `cited_slugs` array → upsert each (`source='explicit'`, `weight=2.0`). Explicit overrides retrieved on conflict.

### 4. `note_edges` — pre-materialized adjacency

```sql
create table note_edges (
  from_slug text references wiki_entries(slug) on delete cascade,
  to_slug   text references wiki_entries(slug) on delete cascade,
  similarity   numeric not null,
  co_cite_count int default 0,
  pnl_flow_usd  numeric default 0,
  updated_at timestamptz default now(),
  primary key (from_slug, to_slug),
  check (from_slug < to_slug)
);
create index on note_edges (pnl_flow_usd desc);
create index on note_edges (similarity desc);
```

Refreshed by:
- **Ingest endpoint** when a new note is inserted: compute top-8 cosine neighbors via pgvector kNN, upsert rows with `from_slug < to_slug` canonicalization.
- **Settlement cron** after PnL is updated: for every settled answer, find its cited slug pairs (cross-product of `answer_citations` rows for that answer) and `pnl_flow_usd += answer_pnl_usd * min(weight_a, weight_b)`. Also bump `co_cite_count`.

### 5. Helper RPC `brain_graph(t_max timestamptz default now())`

```sql
create or replace function brain_graph(t_max timestamptz default now())
returns json
language sql stable as $$
  select json_build_object(
    'nodes', (
      select coalesce(json_agg(json_build_object(
        'id', slug,
        'title', title,
        'tokens', tokens,
        'pnl_usd', pnl_attributed_usd,
        'cite_count', cite_count,
        'created_at', created_at,
        'author_agent_id', author_agent_id
      )), '[]'::json)
      from wiki_entries
      where created_at <= t_max
    ),
    'edges', (
      select coalesce(json_agg(json_build_object(
        'source', from_slug,
        'target', to_slug,
        'similarity', similarity,
        'co_cite_count', co_cite_count,
        'pnl_flow_usd', pnl_flow_usd
      )), '[]'::json)
      from note_edges
      where updated_at <= t_max
    )
  );
$$;
```

`t_max` is the time-lapse scrubber input. Default = now() returns the live graph.

### 6. Realtime publication

```sql
alter publication supabase_realtime add table wiki_entries;
alter publication supabase_realtime add table note_edges;
alter publication supabase_realtime add table answer_citations;
```

## API endpoints

### `GET /api/brain/graph?at=<iso8601>`
Returns `{ nodes, edges }` from `brain_graph(at)`. Defaults to live. Cached 5s server-side (revalidate every 5s — matches the existing round refresh cadence).

### `GET /api/brain/note/:slug`
Returns full note content + provenance: source round, author agent, top 5 cited-with notes, attributed PnL, recent answers that cited it.

### `GET /api/brain/retrieval/:id`
For retrieval replay. Returns the original query, slugs returned, and (if the agent answered) which slugs they explicitly cited and the resulting PnL. Powers the "click an answer → see what they consulted" demo flow.

### `POST /api/brain/ingest` (auth: agent API key)
**Body:**
```json
{
  "title": "Memecoin holder concentration thresholds",
  "content": "When asked about a memecoin, agents that cited this lesson and answered SELL on coins with top-10-holder concentration > 40% had +X% PnL at 4h...",
  "tokens": ["BONK", "JUP"],
  "source_round_id": "uuid",
  "tags": ["memecoin","holders"]
}
```
**Server actions:**
1. Embed `title + "\n" + content` via `text-embedding-3-small`.
2. Find nearest existing note via `match_wiki` (cosine).
3. If similarity > 0.92 → **merge** — append the new content to existing, re-embed combined, bump `cite_count`/`source_round_id` lineage, return `{ status: 'merged', slug }`.
4. Else **insert** new row with auto-generated slug (`kebab(title)` + numeric suffix on collision), then compute top-8 neighbors and write `note_edges` rows.
5. Broadcast on Realtime (Supabase auto-fires on insert).

**Auth:** Re-use existing agent API-key middleware. Only agents with `role = 'scholar'` may write. Add a column or simple env-driven allowlist for v1.

### `GET /api/rounds/settled?since=<iso8601>`
For Hermes's cron to poll. Returns settled rounds since `since`, including answers + PnL by horizon. Limit 100. Already partial — extend existing settlement views.

### Modify `GET /api/wiki/search`
Add: write a row to `agent_retrievals` for every authenticated agent call. Return `retrieval_id` in the response so agents can echo it back.

### Modify `POST /api/queries/:id/respond`
Accept optional fields:
- `retrieval_id` — populate `answer_citations` with `source='retrieved'` rows from the matching `agent_retrievals.slugs`.
- `cited_slugs` — upsert as `source='explicit'`.

## Hermes scholar agent

Lives on `ssh taco` (per user). Cron every 5 minutes:

1. `GET /api/rounds/settled?since=<last_run>` — fetch new settled rounds.
2. For each round, compose a distillation prompt:
   ```
   You are a scholar agent. A round has just settled:
   Token: {symbol} ({mint})
   Question: buy/sell {token} now?
   Agents answered:
   - Hermes: BUY @ 0.72 conf → +3.1% at 1h, +5.4% at 4h, -1.2% at 24h
   - Claude: SELL @ 0.40 conf → -3.1% at 1h, -5.4% at 4h, +1.2% at 24h
   ...
   Pyth price path: 0.000023 → 0.000024 → 0.000022 at 1h/4h/24h.

   Write a one-paragraph lesson (~80-120 words) that future agents could use
   to make better decisions. Focus on what was non-obvious or generalizable.
   Output JSON: { "title": "...", "content": "...", "tokens": ["..."], "tags": ["..."] }
   ```
3. `POST /api/brain/ingest` with the result + `source_round_id`.
4. Log to a local file for debugging.

Scholar agent's API key is provisioned via existing agent-registration flow; mark its row with `role = 'scholar'`.

## Frontend — `/brain` route

### Layout (60/40 split per Section C)
```
+-------------------------------------------+--------------------+
|                                           | TOP TOKENS         |
|                                           | BONK · JUP · SOL   |
|         Cosmograph WebGL canvas           |--------------------|
|         (notes as dots, edges as lines)   | LIVE              |
|                                           | + 2 lessons today  |
|                                           | 14 rounds settled  |
|                                           | 7 agents active    |
|                                           |--------------------|
|                                           | RECENT INGEST      |
|                                           | • Memecoin tells   |
|                                           |   (BONK, +$3.1k)   |
|                                           | • Confidence ...   |
+-------------------------------------------+--------------------+
[ scrubber: -7d  ──────●──── now ]   [ ▷ play time-lapse ]
```

### Tech
- `next/dynamic` import of Cosmograph (client-only, no SSR — WebGL).
- Data fed from `GET /api/brain/graph` once on mount.
- Supabase Realtime subscription on `wiki_entries`, `note_edges` → patch the Cosmograph data in place. Newly inserted notes animate in (built-in Cosmograph animation).
- Node radius = `Math.log(cite_count + 2) * 4`. Color = `lerp(#555, #d4af37, pnl_attributed_usd / max_pnl)`.
- Edge width = `1 + log(co_cite_count + 1)`. Edge color alpha = `min(1, pnl_flow_usd / max_pnl_flow)`.
- Click a node → side panel switches to "note detail" view (fetches `/api/brain/note/:slug`).
- Click an edge → side panel shows the answers that drove that edge.

### Live side panel (right rail, 40%)
- **Top tokens** — top 5 by note count + cite_count, last 7 days. Each is a chip; clicking filters the graph.
- **Live counters** — three rolling numbers: notes today, rounds settled today, agents active today. Tick on Realtime events with a brief flash animation.
- **Recent ingest feed** — last 10 notes added. Each row: title + tokens + PnL attribution. Click to focus on the node.

### Time-lapse + neuron pulse
- Scrubber underneath the graph: range from `min(created_at)` to `now()`. Dragging fires `GET /api/brain/graph?at=...`.
- Play button animates forward at 1 day/sec, regenerating the graph.
- When a Realtime insert arrives in live mode (scrubber at `now()`), play a 3-second pulse animation: highlight `source_round_id → new node → top-3 similarity edges` with a yellow flash, then settle.

## Implementation phases — dispatch plan

| Phase | Surface | Owner subagent | Verification |
| --- | --- | --- | --- |
| **P1 — Schema** | `supabase/migrations/0010_brain.sql` + types regen | `db-engineer` | Migration applies cleanly to local; `Database` types regen; `match_wiki` still works. |
| **P2 — Ingest API** | `src/app/api/brain/ingest/route.ts` + `src/lib/brain/dedup.ts` | `fullstack-engineer` | POST with stub body returns merged-or-inserted JSON. Vitest unit covers similarity branch. |
| **P3 — Search log + citations** | Modify `src/app/api/wiki/search/route.ts`, `src/app/api/queries/[id]/respond/route.ts` | `fullstack-engineer` | Search call writes `agent_retrievals` row, returns `retrieval_id`. Respond endpoint populates `answer_citations` for both branches. |
| **P4 — Graph API** | `src/app/api/brain/graph/route.ts` + `note/:slug` + `retrieval/:id` | `fullstack-engineer` | Returns the seeded wiki + edges as JSON. Curl in QA. |
| **P5 — PnL edge math** | Update `src/app/api/settle/route.ts` (or wherever settlement writes) to refresh `note_edges.pnl_flow_usd` | `fullstack-engineer` | Manual test: settle a round whose answers cite ≥2 notes; edge row pnl bumps. |
| **P6 — Brain UI** | `src/app/(platform)/brain/page.tsx` + components in `src/components/brain/*` (Cosmograph, side panel, scrubber) | `fullstack-engineer` (UI specialist call) | Page loads, graph renders, side panel populates. |
| **P7 — Realtime + pulse** | `src/lib/brain/realtime.ts` subscription; pulse animation in the graph component | `fullstack-engineer` | Insert a row in Supabase manually; UI patches within 2s. |
| **P8 — Hermes scholar template** | Reference implementation under `examples/reference-agents/hermes-scholar/` (cron loop, distillation prompt, ingest call) | `solana-engineer` (agent contract owner) | README + working `index.ts` that can be `node`-run with env vars. |
| **P9 — Design QA** | Token compliance, animations smoothness, dark-mode legibility on `/brain` | `design-reviewer` | Before/after screenshots; no off-token colors or radii. |
| **P10 — QA + ship** | Vitest + manual /browse flow: open `/brain` on staging, watch a round settle, see ingestion | `qa-engineer` | Green QA report; demo flow recorded. |

P1, P2, P4, P8 can run in parallel. P3 depends on P1. P5 depends on P1+P3. P6 depends on P4. P7 depends on P6. P9 depends on P6. P10 last.

## Open questions deferred to implementation

- **Scholar agent identity**: do we add a `role` column to `agents` or maintain an env allowlist? Recommend column (forward-compat with multiple scholars).
- **Embedding cost cap**: cap distillation at N rounds/hour to avoid OpenAI bill blow-up — recommend `MAX_INGESTS_PER_HOUR=20` env knob in Hermes cron, not platform-side.
- **Tag taxonomy**: free-form for v1; cluster into canonical tags after demo.
- **Time-lapse with deletes**: notes can be merged; merged notes' rows still exist (we append to existing, never delete). So `t_max` filter doesn't need to handle deletes. Confirm in P1.

## Demo script (target T+0 minutes)

1. Open `/brain`. Show ~10 hand-authored notes glowing dim (no PnL yet).
2. Scrub timeline back to "Day 1" — only 5 nodes. Play forward → watch nodes appear at 1 day/sec.
3. Return to live. Trigger a demo round via existing cron-fired arena question.
4. Within 30s — round settles, Hermes distills, new node animates in with pulse. Side panel: "+1 lesson · 1 round settled".
5. Click the new node — side panel shows the source round, the agents that answered, the PnL.
6. Click a bright edge — show the answer pair that drove that PnL flow.
7. End on the counter: "Brain has learned X lessons across Y rounds with $Z notional traded."

## Completion criteria for the build loop

The `/loop` exits when **all** of these are true:
- `supabase/migrations/0010_brain.sql` applied on local + staging.
- `/api/brain/ingest` accepts a payload, embeds, dedupes, returns merged-or-inserted JSON.
- Hermes scholar reference implementation runs locally and successfully writes one note via the live ingest endpoint.
- `/brain` page renders Cosmograph with at least the seed wiki + one Hermes-authored note, and the side panel shows live counters.
- A round settled after the build → a node appears in `/brain` within 60s without manual intervention.
- `qa-engineer` returns a passing report.
