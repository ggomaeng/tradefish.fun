---
name: tradefish-design
description: Generate well-branded interfaces for TradeFish — a Solana-native arena where AI trading agents stake answers as paper trades, build PnL-based reputation, and the market keeps score. Use when designing landing pages, live arena / round screens, leaderboard, agent dashboards, claim flows, or any TradeFish surface.
---

# TradeFish — Design System v2 (post-zip)

> **2026-05-09** — System replaced. Old "cool-black ocean / Departure Mono / pixel-terminal" lock superseded by the v2 zip handoff. Reference HTML: `tradefish-platform/.claude/skills/tradefish-design/index.html` (mirrors `/tmp/tradefish-v2-extract/`).

## Brand essence
**claude.ai calm + codex precision + pump.fun cleanness.** Dark default. Cyan brand (derived from the TradeFish logo). Solana gradient as a one-shot accent — never solid. No terminal chrome, no scanlines, no box-drawing. Inter sans + JetBrains Mono numerics.

## Voice
- "TradeFish" — title-case product name (not lowercase, not all-caps).
- "An arena where AI agents trade and the market keeps score."
- "The platform is a contract." "Wallet pubkey is identity."
- Avoid: terminal jargon, "pixel-glitch", "swarm intelligence" (use "arena" or "agents"), all-caps body copy.

## Visual rules
- **Backgrounds:** dark scale `#0A0A0B → #25252C` (`--bg-0..bg-4`). Cards on `--bg-2`. Light parity: opt-in `[data-theme="light"]`.
- **Brand cyan** `#5EEAF0` is the only solid brand color. Use for active links, the primary CTA hover state, `LIVE` chip, verified marks.
- **Solana gradient** `linear-gradient(135deg, #9945FF 0%, #14F195 100%)` appears at most **once per page** — typically the live badge in the hero or a single key word in a headline (`<span class="t-grad">`). Never on body copy. Never as a chip background.
- **Trading semantic**: LONG = `#14F195` (mint/up), SHORT = `#FF4D6D` (red/down), HOLD = `#FFB347` (amber). All have soft `*-bg` translucent variants for chip backgrounds.
- **Radii**: 4 / 6 / 8 / 12 / 999px. Buttons use `--r-2` (6px), cards use `--r-3` (8px), modals + panels use `--r-4` (12px). Sharp corners are out.
- **Borders**: subtle `rgba(255,255,255,0.06 / 0.10 / 0.18)` (`--bd-1..bd-3`). Never use brand color for default borders.
- **Shadows**: low-key, dark — `0 24px 60px rgba(0,0,0,0.45)` for raised panels. No glow halos.

## Type
- Family: **Inter** (sans, body) + **JetBrains Mono** (numerics, code, pubkeys). Loaded via `next/font/google` in root `layout.tsx`.
- Scale: `display 56 / h1 32 / h2 22 / h3 16 / body 14 / small 13 / mini 11`.
- Display + h1 use tight tracking (`-0.025 to -0.04em`). Body line-height 1.5.
- `.num` class for any tabular numeric — switches to JetBrains Mono with `tabular-nums`.

## Iconography
Use real SF-Symbols-equivalent geometric glyphs sparingly: `▲ ▼ · ◆ ◈ ◉` for trade direction / claim affordances. Avoid box-drawing (`┌─ ━ ═`). No emoji.

## Component primitives
- `.btn` / `.btn-primary` / `.btn-ghost` / `.btn-sol` (gradient — rare) / `.btn-sm` / `.btn-lg`
- `.chip` / `.chip-up` / `.chip-down` / `.chip-hold` / `.chip-cyan` / `.chip-live` (with `<span class="dot" />` pulse)
- `.card` / `.card-hover`
- `.wallet` (pubkey chip with avatar gradient)
- `.token` + `.token-{bonk,sol,jup,wif,pyth,jto}` (28px circle markers)
- `.av` + `.av-{2..8}` (avatar gradients)
- `.appnav` (sticky top nav with logo + nav + WalletWidget + CTA)
- `.codeblock` (syntax-tinted code)

## Surfaces
1. **Waitlist landing** (root `/`) — hero with logo flourish (right-side), Solana-gradient live badge, headline with one `t-grad` word, lede, WaitlistForm, 4-stat strip, 3 persona cards.
2. **/arena** — left canvas (orbiting agent nodes on radial-gradient backdrop with overlay chips/CTA) + right activity feed sidebar.
3. **/ask** — left main (token grid + composer with typed question + Open round CTA) + right rail (balance card + scoring explainer).
4. **/round/[id]** — round head (chips + question + countdown) + 4-cell price bar + 2-col body (timeline + tally rail).
5. **/agents** — leaderboard table with rank / agent / tier / score / sharpe / N / PnL / status.
6. **/agents/[id]** — agent hero (80px tile + name + verified chip) + 4-stat strip + body (3 perf cards + persona + OwnerControls) + onboarding rail.
7. **/agents/register** — docs-shell (left nav + main with 3 numbered steps + codeblocks).
8. **/claim/[token]** — 2-col: orbital wallet stage (left) + claim pane (stepper + message preview + cards + CTAs).
9. **/docs** — light-mode docs-shell mirror of `/skill.md`.
10. **TopupModal** — 3-amount picker (0.01 / 0.05 / 0.1 SOL) + breakdown rows + Sign & send CTA.

## Source of truth
- Tokens + components live in `src/app/globals.css` (this layer is canonical — the `colors_and_type.css` and `styles.css` in this skill folder are reference snapshots, not consumed at build).
- Hero/marketing reference: `index.html` (extracted from the v2 zip handoff).
- Logo: `public/logo.png`.
