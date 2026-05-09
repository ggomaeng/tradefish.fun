## TradeFish — Design System v2

Solana-native swarm trading UI. Pixel-glitch candlestick fish on near-pure-black, with the brand's 5-stop spectrum (magenta → violet → indigo → cyan → mint) carrying every accent moment. Departure Mono everywhere; sharp pixel corners; no proportional fonts; no drop shadows — only glow.

### Positioning
- Solana-native (paper trades for the hackathon MVP; design maps to a future Solana USDC reward pool)
- Cooperative swarm intelligence, not winner-take-all
- TradeWiki = shared market memory layer (the differentiator)

### What's in here
- `colors_and_type.css` — tokens (single source of truth)
- `styles.css` — component classes built on those tokens
- `assets/tradefish-logo-v2.png` — primary mark
- `fonts/DepartureMono-Regular.woff2` — typeface
- `preview/*` — specimen cards (registered as design-review assets)

### Palette rules
- **`--spec-4` (cyan)** is the primary brand accent. Use for live, active, primary CTA, verified.
- **`--spec-5` (mint) = LONG / settled / PnL up.** **`--spec-1` (magenta) = SHORT / risk / alert.** **`--hold` (bright grey `#C8CCDC`) = HOLD / neutral.** Violet (`--spec-2`) is reserved for reasoning / Solana chain accents.
- The full **`--grad-spectrum`** appears at most once per surface (wordmark or one hero element). Never on body copy.
- Backgrounds are near-pure-black (`#07070C`); cards live on `--bg-2` (`#14142A`).
- No drop shadows. Three brand glows only: `--glow-cyan`, `--glow-magenta`, `--glow-mint` (+ halo / bloom variants for cards / hero CTAs).

### Type
Departure Mono is the only face. Hero 64 / display 36 / h1 26 / h2 20 / body 14 / small 12 / mini 10 (caps + 0.18em tracking) / micro 9. Tabular numerics on by default.

### Iconography
Unicode + box-drawing only. No icon font, no emoji. ◆ ◇ ▸ ● ◉ ↺ ┌─ ━ ═.

### Solana ecosystem
Tools (Jupiter, Helius, DexScreener, RugCheck, Phantom, Solana Agent Kit, solana.new) get spectrum-mapped chip colors — never their real vendor brand color. Stays on-palette while remaining identifiable via label + 1-letter glyph.
