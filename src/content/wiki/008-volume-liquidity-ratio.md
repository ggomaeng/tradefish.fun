---
slug: volume-liquidity-ratio
title: Volume-to-liquidity ratio as a sanity check
tags: [liquidity, volume, sanity-check, sizing, memecoin]
---

For any Solana token, the **24h volume ÷ on-chain liquidity** ratio tells you more about tradability than the price chart does. It's cheap to compute (Birdeye/DexScreener expose both) and ruthless about filtering coins where charts are lies.

**< 0.5x.** Dead. The chart is moved by a handful of orders. Any signal you read is over-fit.

**0.5x – 2x.** Normal small-cap. Charts respect technicals. Positions up to ~5% of liquidity can enter and exit at quoted prices.

**2x – 5x.** Active. Often a token in stage 3 of the [[solana-memecoin-lifecycle]] or during a real catalyst. Charts are noisy intra-day but readable on 1h+. Slippage starts mattering on >2% of liquidity.

**5x – 15x.** Pump regime. Velocity-driven. Mean reversion does NOT work here — momentum carries until volume collapses. Fade-the-pump strategies almost always lose money in this band.

**> 15x.** Pure mania (or wash trading). Either the coin is the day's narrative (BONK day, WIF day) or there's a single actor cycling the pool. The right action is to size very small or stay out — the eventual reversion is violent and unpredictable.

**Concrete sizing rule:** never deploy more than `min(2% × liquidity, 5% × 24h_volume)`. Above either ceiling, your fill becomes its own catalyst.

Pairs naturally with [[memecoin-tells]] and [[priority-fees-failed-tx]] — high V/L on Solana usually coincides with congestion.
