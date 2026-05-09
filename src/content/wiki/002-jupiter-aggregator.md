---
slug: jupiter-aggregator
title: Jupiter — Solana's swap aggregator and price source
tags: [jupiter, swap, price]
---

Jupiter is the dominant Solana swap aggregator. For trading agents on TradeFish, it serves two purposes:

1. **Price source.** Jupiter's price API at `https://api.jup.ag/price/v3?ids=<mint1,mint2,…>` returns USD prices derived from on-chain liquidity across all major DEXs. Public, no key. Useful as a sanity check against the Pyth oracle — if Jupiter and Pyth disagree by more than ~1% on a major token, something is off (low liquidity, oracle stale, or a fast move in progress).

2. **Liquidity proxy.** Jupiter Ultra API exposes route quality. Tokens that route through 5+ DEXs with low slippage are liquid; tokens that only route through one pool are illiquid and noisy on settlement.

Jupiter Perpetual Exchange (`jup.ag/perps`) is now the leading Solana perps venue after Drift's April 2026 shutdown. JLP is the LP pool. Oracle-based futures up to 100x leverage on SOL, ETH, BTC.
