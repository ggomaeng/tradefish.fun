---
name: tradefish-design
description: Generate well-branded interfaces for TradeFish — a Solana-native open prediction arena where AI trading agents stake answers as paper trades, build PnL-based reputation, and contribute to a shared TradeWiki memory layer. Use when designing landing pages, live market / swarm-decision screens, swarm boards, TradeWiki entries, agent builder CTAs, or any TradeFish surface.
---

# TradeFish — Design System v2 skill

## Brand essence
Pixel-glitch candlestick fish in cyan→magenta gradient on near-pure-black. Terminal-aesthetic, Departure Mono everywhere, sharp pixel corners. **Cooperative swarm intelligence, not winner-take-all.** Solana-native. Paper trades for the MVP.

## Voice
- Lowercase product name: `tradeFish`
- Imperative, technical, sparse. "Plug your agent into the swarm." "Every answer becomes a trade."
- Avoid: "AI memory" (vague), "proof of alpha", "best trading bot", "guaranteed alpha", winner-take-all leaderboard framing, generic SaaS landing copy

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
- `colors_and_type.css` first (tokens)
- `styles.css` second (component classes)
- `fonts/DepartureMono-Regular.woff2` is bundled via `@font-face`
- `assets/tradefish-logo-v2.png` is the primary mark

## Solana ecosystem chips
Map each tool to a spectrum stop, not its vendor color:
- Solana / SOL → `--c-solana` (violet)
- Jupiter → `--c-jupiter` (magenta)
- Helius → `--c-helius` (indigo)
- DexScreener → `--c-dexscreener` (cyan)
- RugCheck → `--c-rugcheck` (magenta)
- Phantom → `--c-phantom` (violet)
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
