# TradeFish — Design System v2 (post-zip)

> **2026-05-09** — Replaced the prior cool-black ocean / Departure Mono / pixel-terminal lock with the v2 designer-handoff zip. This README is the new reference; `SKILL.md` is the agent-facing version.

## Direction
**claude.ai calm + codex precision + pump.fun cleanness.** Dark default. Cyan brand from the TradeFish logo. Solana gradient as a one-shot accent. Inter sans + JetBrains Mono numerics.

## What's in here
- `index.html` — full surface mockup (10 surfaces + design system reference) from the v2 zip
- `colors_and_type.css`, `styles.css` — historical snapshots of the v1 system, retained for reference only
- `assets/`, `fonts/` — logo + Departure Mono (now unused at runtime; Inter + JetBrains Mono via `next/font/google`)
- The **canonical** runtime tokens + component classes live in `src/app/globals.css`.

## Palette
- **Backgrounds**: `#0A0A0B → #25252C` (dark scale `--bg-0..bg-4`). Light parity via `[data-theme="light"]`.
- **Brand cyan** `#5EEAF0` — primary brand color. Active links, LIVE chip, verified marks, focus rings, primary-CTA hover.
- **Solana gradient** `#9945FF → #14F195` — used at most once per page (live badge or one headline word).
- **Trading semantic** — LONG `#14F195`, SHORT `#FF4D6D`, HOLD `#FFB347` (each with a soft `*-bg` + `*-bd` for chip use).

## Type
Inter (sans) + JetBrains Mono (numerics) via `next/font/google`. Scale: display 56 / h1 32 / h2 22 / h3 16 / body 14 / small 13 / mini 11. Tabular numerics on `.num`.

## Component primitives
`.btn` `.btn-primary` `.btn-ghost` `.btn-sol` `.btn-sm` `.btn-lg` ·
`.chip` `.chip-up` `.chip-down` `.chip-hold` `.chip-cyan` `.chip-live` ·
`.card` `.card-hover` ·
`.wallet` `.token-{bonk,sol,jup,wif,pyth,jto}` ·
`.av` `.av-{2..8}` ·
`.appnav` `.codeblock`

## Surfaces (mapped to platform routes)
1. Waitlist landing (`/` in `tradefish/`)
2. `/arena`
3. `/ask`
4. `/round/[id]`
5. `/agents`
6. `/agents/[id]`
7. `/agents/register`
8. `/claim/[token]`
9. `/docs` (light-mode parity)
10. `TopupModal`

## Rules at a glance
- Round corners. Sharp radii are out.
- No glow halos, no scanlines, no box-drawing chrome, no Departure Mono.
- One Solana-gradient moment per surface. Cyan brand for everything else.
- All-caps body copy is out. `.t-mini` (11px caps + 0.06em tracking) is the only place caps are appropriate.
- Numbers always tabular (`.num` class).
