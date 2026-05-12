# Design system v3 restyle — design doc

**Branch:** `feat/design-system-v3`
**Status:** Approved through Round 2 (landing + ask + arena). Round 3+ deferred.
**Co-owner risk:** `feat/brain-tab` (teammate) overlaps on `globals.css`, `layout.tsx`, `src/app/page.tsx`, `HeroAsk.tsx`, `HeroSwarm.tsx`, `(platform)/layout.tsx`. **We ship first; teammate rebases onto the new tokens.**

## Goal

Replace the current "v2 — claude.ai calm + codex precision" design system with the new pixel-glitch + 5-stop spectrum system handed off in `/Users/tomo/Downloads/TF-design-system-/`. Restyle the public landing page (restructured to a new 9-section flow) and the two highest-traffic platform surfaces (`/arena`, `/ask`). Keep all functionality, data flow, routing, and JSX structure outside the landing.

## Non-goals (out of scope for this PR)

- `/round/[id]`, `/agents`, `/agents/[id]`, `/agents/register`, `/claim/[token]`, `/docs`, `/terms`, modals — deferred to a follow-up PR after `feat/brain-tab` merges.
- New features (TradeWiki, Swarm Board renaming, lowercase `tradeFish`, light-mode parity) — explicitly NOT adopted from the source SKILL.md.
- Schema changes, route changes, API behavior, polling/refresh behavior, accessibility regressions.

## Voice resolution (applies app-wide once Section A lands)

| Axis                    | Rule                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| Product name            | `TradeFish` title-case (override source SKILL.md lowercase)                                              |
| `/agents` page name     | `Leaderboard` (override source SKILL.md "Swarm Board")                                                   |
| Primary CTAs            | Mono caps + arrow — `ASK →` `SUBMIT →` `CONNECT WALLET →` `OPEN ROUND →` `COPY PROMPT →`                 |
| Secondary/ghost CTAs    | Title case, no arrow — `Cancel` `View details` `Read the skill` `Edit`                                   |
| State labels            | Mono caps short codes — `LIVE` `LOCKED` `SETTLED` `PENDING` `EXPIRED` `CLAIMED` `ACTIVE` `VERIFIED`      |
| Empty / error / loading | Sparse but kind — `No rounds yet.` / `Couldn't load. Retry?` / `Loading…` (full sentences, not all-caps) |
| PnL                     | `▲ 12.4%` mint · `▼ 8.1%` magenta (glyph + color carries direction)                                      |
| Durations               | Natural — `4m left` `4h ago` `23 minutes left`                                                           |
| Countdowns              | Mono `MM:SS` / `HH:MM:SS` with Departure Mono digits (precision-critical)                                |
| Wallets                 | `ABC…XYZ` natural ellipsis                                                                               |

## Section A — Foundation install (touches every page)

### Skill folder

Replace contents of `.claude/skills/tradefish-design/` with the new handoff folder. Preserve `v1-reference/` and `styles-v1-reference.css` for history (not consumed).

- `colors_and_type.css` (tokens, 446 lines)
- `system.css` (component classes; renamed from old `styles.css`)
- `SKILL.md` — copy from source, append two project overrides at the top:
  - "TradeFish" stays title-case in product UI.
  - "Leaderboard" stays as the name of `/agents`.
- `README.md`, `index.html`, `question.html`, `design-system.html`, `pitch-deck.html`, `fonts/`, `assets/`, `preview/` — copy from source.

### Fonts

`layout.tsx` already loads Inter, JetBrains Mono, Geist, and Departure Mono. Changes:

- **Add** `Geist_Mono` via `next/font/google` → `--font-geist-mono`.
- **Keep** Inter + JetBrains Mono loaded for the restyle window (used by un-touched platform pages). Remove in cleanup PR.
- **Update** the metadata `description` to drop "The platform is a contract" phrasing — replace with: "An arena where AI agents stake answers as paper trades. Live Pyth prices score every call. Solana mainnet."

### `src/app/globals.css`

Replace the `:root` block with the new tokens from `colors_and_type.css`:

- 5-stop spectrum (`--spec-1..spec-5`, magenta → violet → indigo → cyan → mint) + soft/dim variants.
- `--grad-spectrum`, `--grad-fish`, `--grad-spectrum-wash`.
- Trading semantics — `--long` (mint), `--short` (magenta), `--hold` (bright grey `#C8CCDC`).
- Surfaces — `--bg-0 #07070C` (page), `--bg-1`, `--bg-2 #14142A` (card), `--bg-3`.
- Hairlines — `--line`, `--line-strong`, `--line-bright`, `--line-cyan / -magenta / -mint`.
- Foreground — `--fg`, `--fg-dim`, `--fg-faint`, `--fg-faintest`.
- Glow system — `--glow-cyan / -magenta / -mint / -violet`, halo + bloom variants.
- Three-tier type stack — `--font-pixel` (Departure Mono), `--font-mono` (Geist Mono), `--font-display` (Geist Mono), `--font-sans` (Geist).
- Type scale (`--t-hero` 64 / `--t-display` 36 / `--t-h1` 26 / `--t-h2` 20 / `--t-body` 14 / `--t-small` 12 / `--t-mini` 10 / `--t-micro` 9).
- Radii (`--r-0` 0 default; `--r-pill` 999px; `--r-icon` 22%).
- Spacing (8px grid), motion (`--t-fast` 150ms, `--t-med` 280ms).
- Reputation/event accents (`--verified`, `--revive`, `--reput`, `--ev-fire/-settle/-change/-comment/-revive`).
- Solana ecosystem chip accents (`--c-solana`, `--c-jupiter`, `--c-helius`, `--c-dexscreener`, `--c-rugcheck`, `--c-phantom`, `--c-agentkit`).

**Alias bridge** — to avoid landmines on untouched platform pages, keep these legacy aliases pointing at the new tokens:

| Legacy                                      | Points at                                                 |
| ------------------------------------------- | --------------------------------------------------------- |
| `--cyan` (existing)                         | `var(--spec-4)` — narrows from `#5EEAF0` to `#4cd8e8`     |
| `--up`, `--up-bg`, `--up-bd`                | `var(--long)`, `var(--long-bg)`, `var(--line-mint)`       |
| `--down`, `--down-bg`, `--down-bd`          | `var(--short)`, `var(--short-bg)`, `var(--line-magenta)`  |
| `--hold-bg`, `--hold-bd`                    | bright grey 8%/30% (replaces amber tints)                 |
| `--bd-1`, `--bd-2`, `--bd-3`                | `var(--line)`, `var(--line-strong)`, `var(--line-bright)` |
| `--r-1..r-4`                                | all → `var(--r-0)` (sharp everywhere)                     |
| `--fg-2`, `--fg-3`, `--fg-4`                | `var(--fg-dim)`, `var(--fg-faint)`, `var(--fg-faintest)`  |
| `--sol-purple`, `--sol-green`, `--sol-grad` | `var(--spec-2)`, `var(--spec-5)`, `var(--grad-spectrum)`  |

Then replace the component layer with `system.css` content (`.btn / .btn-primary / .btn-ghost / .btn-sol / .chip / .chip-up / .chip-down / .chip-hold / .chip-live / .card / .codeblock / .t-hero/display/h1/h2/body/small/label/step/tier / .t-spectrum / .tf-scanlines / .tf-grid-bg / .tf-caret / .num / .wallet / .av / .token`, plus the panel `┌─ TITLE` pattern via `.panel .panel-hd .ttl::before { content: '┌─ ' }`).

Add Tailwind compatibility — keep `@import "tailwindcss"` at the top. The platform pages use a mix of Tailwind utilities and inline CSS-variable styles; both keep working.

### `CLAUDE.md` (project root)

Update the "Design — LOCKED" paragraph to describe the new system (5-stop spectrum, near-pure-black `#07070C`, three-tier type ladder Departure / Geist Mono / Geist, sharp corners `--r-0`, glow-only no drop shadows). Add: "TradeFish stays title-case in product UI; `/agents` stays as Leaderboard."

## Section B — Landing restructure (`src/app/page.tsx`)

Drop the ocean hero (LightRays, HeroSwarm, `.tf-landing-hero` scoped block, `tf-ocean-light / tf-dust-motes / tf-debris` background layers, the linear gradient ocean background).

Keep `RevealStagger` / `RevealSection` for scroll reveals (animation utility, not visual). Keep `HeroAsk` only if its ask-input shape matches the new hero spec; otherwise replace inline.

Implement the 9-section flow:

1. **Hero**
   - Background: `--bg-0` near-pure-black, fixed `tf-scanlines` overlay (full-page, low opacity), `tf-grid-bg` dot-grid radial mask, soft spectrum bloom behind the logo.
   - Logo (`public/logo.png`) + wordmark `<span class="t-spectrum">TradeFish</span>` (spectrum text effect on title-case product name).
   - H1 (`.t-hero` Departure Mono): **ASK THE TRADING SWARM.**
   - Subhead (`.t-body` Geist): "AI agents answer long, short, or hold. Live Pyth prices score every call."
   - Ask input row: sharp-cornered, mono placeholder `should i long $SOL for the next 4h?`, `.tf-caret` cyan blink on focus, `--halo-cyan` on focus. Primary CTA `ASK →` in `.btn-sol` (spectrum gradient — used once per page, this is its spot). Secondary `Register an agent →` in ghost.
   - Mini loop strip below input: `.t-label` mono caps tracking `ASK → AGENTS ANSWER → PYTH SCORES`.

2. **Agent registration box**
   - Card on `--bg-2`, sharp corners, `┌─ REGISTER ANY AI AGENT IN 30 SECONDS` panel header.
   - `.codeblock` with: `Read https://tradefish.fun/skill.md and register an agent for me on TradeFish.`
   - `.t-small fg-dim`: "Paste this into OpenClaw, Hermes, Claude, Codex, or any autonomous agent."
   - `COPY PROMPT →` button with cyan glow on hover.

3. **Stats strip** — 4 cells, `.t-label` caps + Departure Mono numerics, hairline borders between cells.
   - `AGENT API · LIVE` (with cyan pulse dot)
   - `SETTLEMENT · 1H / 4H / 24H`
   - `TOKENS COVERED · 8`
   - `PRICE SOURCE · PYTH ORACLE`

4. **How it works** — 3 steps, `.t-step` indicators `STEP 01 / 03`, `STEP 02 / 03`, `STEP 03 / 03`.
   - 01 **Ask.** "Connect Phantom and spend SOL credits to open a token round. Agents see your question the moment it lands."
   - 02 **Agents answer.** "Registered agents poll pending rounds, submit direction, confidence, and public reasoning before the deadline. Late answers are rejected."
   - 03 **Pyth scores.** "TradeFish settles each answer at 1h, 4h, and 24h using live Pyth prices. Correct calls earn PnL. Wrong calls lose it. Hold wins when price barely moves."
   - Small detail under 03 (`.t-label`): `RANKED BY SHARPE × LOG(SAMPLE SIZE)`

5. **Scoring card** — single compact card.
   - Title (`.t-h2`): "How agents are ranked"
   - Copy (`.t-body`): "Agents are not ranked by hype. They are ranked by risk-adjusted performance."
   - Formula row, large mono: `Score = Sharpe × log(sample size)`
   - Explainer: "This rewards agents that are consistently right across many rounds, not agents that win one lucky trade."
   - Pull quote (Departure Mono small caps, `.t-spectrum` text): **"Calibration beats conviction. Patience beats lottery."**

6. **Personas** — 3 compact cards.
   - **Spectator** — "Watch the arena." "No wallet needed. Watch agents respond live, follow rounds, and track the leaderboard." CTA: `Enter arena →`
   - **Asker** — "Ask the swarm." "Connect Phantom, spend credits, and open token rounds for agents to answer." CTA: `Ask a question →` · Req: `PHANTOM · SOL CREDITS`
   - **Builder** — "Register an agent." "Point your AI agent to /skill.md. It self-registers over HTTP, receives an API key, and can be claimed with a wallet signature." CTA: `Read the skill →` · Req: `AGENT + WALLET SIGNATURE`

7. **Technical proof** — bulleted list, title "Built as an agent-first protocol".
   - Public skill file: `/skill.md`
   - HTTP self-registration for agents
   - Wallet signature for builder ownership
   - Pyth Hermes settlement
   - Supabase Realtime for live arena updates
   - Vercel cron for settlement
   - Solana mainnet payments via Phantom

8. **Powered by** — credibility badges, monochrome, small.
   - Solana mainnet · Pyth Network · Phantom · Supabase Realtime · Vercel

9. **Footer**
   - "TradeFish · tradefish.fun"
   - "Solana mainnet payments · Pyth oracle settlement · Paper trading only — not investment advice."

## Section C — `/arena` restyle (`src/app/(platform)/arena/page.tsx` + `src/components/arena/*`)

**Structure preserved.** Canvas (left) + LiveActivity (right rail) grid, LiveStats below, PastRounds at bottom. No JSX or data changes.

Visual:

- Page chrome — drop drop-shadow + soft corners. Fixed `tf-scanlines` overlay; `tf-grid-bg` mask behind Canvas.
- Canvas panel — sharp corners, `--line-cyan` hairline, `--halo-cyan` outer glow when round is LIVE.
- `AgentNode` — soft spectrum tint per state (idle = `--fg-faintest`, responding = cyan halo pulse, settled = mint halo, change = magenta halo).
- LiveActivity — `┌─ LIVE ACTIVITY` panel header. Each event row gets a 4px left bar from `--ev-fire / -settle / -change / -comment / -revive`.
- LiveStats — Departure Mono hero numerics (`.t-pixel`), `.t-label` caps for units. PnL deltas as `▲ x%` mint / `▼ x%` magenta.
- PastRounds — sharp-cornered rows, mono `LIVE / SETTLED / EXPIRED` chips, ▲/▼ PnL, "4h ago" natural durations.

Copy:

- Eyebrow `SURFACE · LIVE` stays.
- H1: "The live canvas." → **"The live arena."**
- Lede: "Calm ambient swarm. Each node is an agent. Activity pulses on response and settle." → **"Each node is an agent. Pulse on answer. Halo on settle."**
- LiveActivity empty: → "No activity yet. Standing by."
- PastRounds empty: → "No settled rounds yet."
- Page title meta: `Live arena — TradeFish` stays.

## Section D — `/ask` restyle (`src/app/(platform)/ask/page.tsx` + `src/components/query/QueryComposer.tsx`)

**Structure preserved.** QueryComposer is the entire surface.

Visual (inside QueryComposer):

- Token grid chips — spectrum mapping per design system (`--c-solana` violet, `--c-jupiter` magenta, etc.). Border + label, no filled bg. Selected = cyan border + inset `tf-grid-bg`.
- Composer input — sharp corners, mono placeholder, `.tf-caret` cyan blink on focus, `--line-cyan` border, `--halo-cyan` on focus.
- Primary CTA — `OPEN ROUND →` in `.btn-sol` spectrum (the one-shot spectrum CTA on this page).
- Wallet balance card — `┌─ BALANCE` header, Departure Mono SOL amount, mono USD subline. Top-up as secondary ghost.
- Scoring explainer rail — `┌─ SCORING` header. `Score = Sharpe × log(N)` mono formula. Bottom: spectrum italic **"Calibration beats conviction. Patience beats lottery."**

Copy:

- Eyebrow `SURFACE · ASK` stays.
- H1: "Open a round." → **"Ask the swarm."**
- Lede: "Token picker, composer, wallet rail. The asker's only job." → **"Pick a token. Ask a question. Agents have until the deadline."**
- Composer label: "Question" → `┌─ ASK`.
- Token grid label: "Select a token" → `┌─ TOKEN`.
- Validation: "Insufficient balance" → **"Not enough SOL. Top up?"**
- After-submit toast: → **"Round opened."** with the new round id chip.
- Page title meta: `Ask the swarm — TradeFish` stays.

## Verification (per section, before commit)

For each section:

1. Run `npm run dev`; load the page in a real browser.
2. Check golden path — landing renders; `/arena` shows the canvas + side rail; `/ask` lets you select a token, type a question, and click `OPEN ROUND →` (mock if needed).
3. Run `npm run build` and `npm run lint` — no new errors.
4. Visual check against the reference HTMLs in `.claude/skills/tradefish-design/index.html` + `question.html`.
5. Confirm un-touched platform pages (`/agents`, `/round/[id]`, `/agents/register`, etc.) still render — they should look subtly different due to the alias bridge but not break.

## Implementation order

1. **Section A — system install** (one commit). Branch verifies build green, all pages still render.
2. **Section B — landing restructure** (one or two commits — Hero first, then sections 2–9).
3. **Section C — /arena** (one commit per component if needed; ~3–5 commits).
4. **Section D — /ask** (one commit, mostly QueryComposer).
5. Open PR to main. Coordinate with teammate on `feat/brain-tab` to rebase onto our tokens.

## Commit message style

Conventional commits with trailers per `CLAUDE.md` git workflow:

- `feat(design): install design system v3 (tokens, components, fonts)` — Section A
- `feat(landing): restructure hero + scoring + personas + proof (design v3)` — Section B
- `feat(arena): restyle live canvas + activity feed (design v3)` — Section C
- `feat(ask): restyle composer + balance + scoring rail (design v3)` — Section D

Include `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.

---

## What shipped (final — 2026-05-12)

The PR ended up scoping wider than the original A/B/C/D plan. After Section D landed, the user redirected to a polish-and-unify pass — preserve existing UX/structure on every surface, layer the Solana terminal feel on top via design-system primitives. 9 polish rounds followed, one atomic commit per surface.

### Foundation (A–B, restoring landing identity after a mid-flight revert)

| Commit | What |
|---|---|
| `5dc0fe0` `feat(design)` | Install v3 skill folder + Geist Mono wiring in `layout.tsx`. |
| `8e480a5` `feat(design)` | Rewrite `globals.css` with v3 tokens + alias bridge + full component layer. |
| `172dc84` then `caded91` | Landing restructure → **reverted** when the user clarified the ocean hero (HeroSwarm + LightRays) is brand identity, not subject to wholesale restructure. |
| `f93343b` / `562a90c` | Two merges from `origin/main` (commits #21, #22, #23, #24 `arena→swarm` rename, #26 brain feature). |
| `1032b50` `fix(appnav)` | Restored platform `.appnav` to match main verbatim — header is shared chrome, not subject to v3 mono-caps without explicit ask. |
| `e5e5ced` `feat(landing)` | Added platform nav links (`SWARM/ASK/AGENTS/BRAIN/DOCS`) to the ocean hero top nav. |
| `3946188` `fix(hero)` | Aligned `HeroAsk` placeholder rotation to the canonical "Buy or sell $TOKEN right now?" — honesty about backend grammar. |

### Polish pass (9 rounds, one commit per surface)

| Commit | Surface | Move |
|---|---|---|
| `aa7fd8f` | Landing below-hero | `┌─ STEP NN` Step labels, Geist Mono titles, sharp persona icons. |
| `7d4bca2` | Landing personas | **Established the "polished card discipline"** — equal heights via flex+minHeight, 4 corner brackets (`┌ ┐ └ ┘`) per card tinted to accent color, sharp pixel req chips, mono caps CTAs. Standard carried into every later round. |
| `8754c17` | `/agents` Leaderboard | `┌─ SURFACE · LEADERBOARD`, ▲/▼ glyph PnL + Sharpe, sharp table chrome. PrizePool (teammate) untouched. |
| `1a43cbc` | `/round/[id]` head | `┌─ QUESTION` panel + spectrum-text `{symbol}` + Departure Mono countdown with cyan glow + `EXPIRED`/`SETTLED` chips. |
| `6619f58` | `/agents/[id]` detail | Verified-chip glyph `◉ VERIFIED`, sharp 80px avatar, `┌─ BANKROLL` Departure Mono panel + ▲/▼ delta. |
| `b8ddf15` + `9038954` | `/brain` | `┌─ SURFACE · LIVE` eyebrow on both SSR + mounted paths (second commit fixed the missed mounted-path during visual verification). |
| `e606dfa` | `/agents/register` | Docs-shell `┌─` eyebrow + Geist Mono h2 steps + cyan-bordered codeblocks. |
| `b0248fa` | `/claim/[token]` | Sharp pixel center block with full `--grad-spectrum` + `--bloom-cyan`, v3 spectrum stop radial bgs (was legacy solana-purple/coral). |
| `cb64fbf` | Shared chrome | `┌─ TOP UP · SOL → CREDITS` TopupModal panel, mono-caps WalletWidget menu, `┌─ SURFACE · X · ERROR` magenta RouteError. |
| `1e0cc9a` | `/docs` + `/terms` | Mono-caps eyebrows + Geist Mono display h1s across both surfaces. |

### Workspace + cleanup

| Commit | What |
|---|---|
| `fb41b18` `feat(db)` | Demo-mode env-var gating so platform pages render RouteError chrome instead of 500ing without Supabase creds. Added `.env.example`. |
| `9a68740` `style(appnav)` | NAV_LINKS uppercased + `hideOnMobile` flags for Brain/Docs. |
| `315910b` `refactor(landing)` | HeroSwarm moved back inside `.tf-landing-hero` scope (was page-fixed). |
| `2ec43a3` `chore(cleanup)` | Dropped Inter + JetBrains_Mono from `layout.tsx` (zero callsites). Removed 27 MB of unused image bloat from `.claude/skills/tradefish-design/uploads/` + 4 reference screenshots. Re-applied footer `<a>` → `<Link>` fix that got reverted during merge. |

### Card discipline standard (established Round 1, applied Rounds 2–9)

Any card-like surface element gets:
- Sharp pixel corners (`var(--r-0)`)
- `var(--surface)` translucent bg, `var(--line)` hairline border
- Equal-height treatment (`height: 100%` + `minHeight` in grids; `flex: 1` on body para to push CTA to the bottom)
- Optional `┌ ┐ └ ┘` corner brackets (mono font, absolutely positioned, tinted to surface accent) when the card represents a persona / step / verdict
- Mono caps CTA at the bottom with arrow (`WATCH THE SWARM →` etc.)
- Sharp pixel-corner requirement chips (drop `--r-pill` rounded)
- Cyan-glow hover (`--glow-cyan` + `--surface-2` bg)

### Voice rules (locked, applied app-wide)

Captured in `CLAUDE.md` "Design — LOCKED" section + `.claude/skills/tradefish-design/SKILL.md` project-override preamble. Future surfaces should match without re-asking.

### Out of scope (intentionally deferred or skipped)

- Light-mode parity (`[data-theme="light"]`) — v3 doesn't ship light tokens yet. `/docs` could use it eventually.
- Pre-existing lint warnings in `examples/reference-agents/`, `PrizePool.tsx`, `OwnerControls.tsx`, `brain/BrainPage.tsx setMounted(true)` — teammate code, separate PR.
- Performance audit on Departure Mono local font load — woff2 is preloaded, FOUT is minimal in practice.
- TopupModal full flow restyle (signing / confirming / success) — only header + dropdown chrome touched; inner phase states still use legacy v2 styling internally.
