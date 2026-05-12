---
name: tradefish-design
description: Generate well-branded interfaces for TradeFish — a Solana-native arena where AI trading agents register over HTTP, answer token questions with direction + confidence + reasoning, and are scored by live Pyth prices. Use when designing landing, live arena, ask, round detail, leaderboard, agent detail, register, claim, or any TradeFish surface.
---

# TradeFish — Design System v3 skill

## Project overrides (read first)

The source design system below was authored for a slightly different product framing. The product as shipped uses these overrides — always honor them when restyling product UI:

- **Product name: `TradeFish` (title-case)** — do NOT use lowercase `tradeFish` anywhere user-visible. The lowercase form in source examples (`index.html` wordmark, etc.) is for the design-system specimen pages; product UI is title-case.
- **`/agents` page is "Leaderboard"** — keep this name. The source's "Swarm Board / contribution board" framing is not adopted.
- **Surfaces actually shipped:** landing (`/`), arena (`/arena`), ask (`/ask`), round detail (`/round/[id]`), leaderboard (`/agents`), agent detail (`/agents/[id]`), register (`/agents/register`), claim (`/claim/[token]`), docs (`/docs`), terms (`/terms`). TradeWiki and Swarm Board are **not** current features — don't design for them.
- **Voice:** title-case "TradeFish" everywhere. Otherwise follow the source voice (imperative, technical, sparse).
- **Primary CTAs:** mono caps + arrow — `ASK →` `SUBMIT →` `CONNECT WALLET →` `OPEN ROUND →` `COPY PROMPT →`. **Secondary / ghost CTAs:** title case, no arrow — `Cancel`, `View details`, `Read the skill`, `Edit`.
- **State labels:** mono caps short codes — `LIVE` `LOCKED` `SETTLED` `PENDING` `EXPIRED` `CLAIMED` `ACTIVE` `VERIFIED`.
- **Empty / error / loading:** sparse but kind full sentences — `No rounds yet.` / `Couldn't load. Retry?` / `Loading…`. Don't all-caps full sentences.
- **PnL:** glyph + color — `▲ 12.4%` mint / `▼ 8.1%` magenta.
- **Durations:** natural — `4m left`, `4h ago`. **Countdowns:** mono `MM:SS` / `HH:MM:SS`.
- **Wallet pubkeys:** `ABC…XYZ` natural ellipsis (single …, not three middle dots).

## Brand essence

Pixel-glitch candlestick fish in cyan→magenta gradient on near-pure-black. Terminal-aesthetic, Departure Mono for hero/numerics, Geist Mono for chrome, Geist for prose. Sharp pixel corners. **Cooperative swarm intelligence**, but the product surfaces a competitive Leaderboard — that's the project's call. Solana-native. Paper trades for the MVP.

## Voice

- Product name: `TradeFish` (title-case) — see overrides above.
- Imperative, technical, sparse. "Plug your agent into the swarm." "Every answer becomes a paper trade." "The oracle keeps score."
- Avoid: "AI memory" (vague), "proof of alpha", "best trading bot", "guaranteed alpha", generic SaaS landing copy

## Visual rules

- Background: `--bg-0` (`#07070C`). Cards: `--bg-2` (`#14142A`). Always.
- One full `--grad-spectrum` moment per surface (wordmark, hero number, single CTA). Never on body copy.
- Direction colors: LONG = mint (`--spec-5`), SHORT = magenta (`--spec-1`), HOLD = bright grey (`--hold` `#C8CCDC`). LIVE / primary = cyan (`--spec-4`). Violet (`--spec-2`) is for reasoning / Solana chain accents, not HOLD.
- No drop shadows. Use `--glow-cyan / --glow-magenta / --glow-mint` (+ halo / bloom).
- All-caps labels with 0.18em tracking. Tabular numerics. Box-drawing chrome (`┌─`, `━`, `═`).
- Sharp corners (`--r-0`). Soft radius (`--r-icon`) reserved for the app-icon lockup container only.

## Type

Departure Mono only. Hero 64 / display 36 / h1 26 / h2 20 / body 14 / small 12 / mini 10 / micro 9.

## Iconography

Unicode + box-drawing only. ◆ ◇ ▸ ● ◉ ↺ ┌─ ━ ═. No icon font, no emoji.

## Files to load

- `colors_and_type.css` first (tokens — also `@import`s Geist + Geist Mono)
- `system.css` second (component classes)
- `fonts/DepartureMono-Regular.woff2` is bundled via `@font-face`
- `assets/tradefish-logo-v2.png` is the primary mark

## Solana ecosystem chips

Map each tool to a spectrum stop, not its vendor color. Every tool gets a unique stop or soft so chips don't collide:

- Solana / SOL → `--c-solana` (violet)
- Jupiter → `--c-jupiter` (magenta)
- Helius → `--c-helius` (indigo)
- DexScreener → `--c-dexscreener` (cyan)
- RugCheck → `--c-rugcheck` (soft magenta — distinct from jupiter)
- Phantom → `--c-phantom` (soft violet — distinct from solana)
- Solana Agent Kit → `--c-agentkit` (mint)

## Surfaces (when asked to design product screens)

1. **Landing** — hero with logo + spectrum wordmark, the swarm thesis, Solana ecosystem chips, agent-builder CTA
2. **Live Market / Swarm Decision** (priority) — single live question, agent prediction cards, weighted UP/DOWN bar, "Paper trade opened"
3. **Swarm Board** — contribution board (NOT leaderboard): weekly PnL, reputation, swarm weight, reward share, tools used. USDC pool card with "Simulated for demo" disclaimer.
4. **TradeWiki** (priority) — settled-prediction knowledge entries: market, signal, tools, reasoning, outcome, PnL, lesson. "The trade is over, but the swarm got smarter."
5. **Agent Builder CTA** — solana.new / Agent Kit waitlist form

Demo asset: SOL/USDC main pair.

Microcopy anchors:

- "Every answer becomes a paper trade."
- "You don't buy influence. You earn it through useful signal."
- "Shared market memory for trading agents."
