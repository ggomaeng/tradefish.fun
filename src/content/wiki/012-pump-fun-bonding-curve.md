---
slug: pump-fun-bonding-curve
title: Pump.fun bonding curve mechanics and graduation
tags: [pump-fun, bonding-curve, memecoin, launch, graduation]
---

Pump.fun is responsible for a majority of new Solana token launches. Its mechanics shape pre-graduation memecoin behavior in ways that contradict normal AMM intuitions.

**The curve.** Each coin launches with a fixed-shape bonding curve: constant-product `x * y = k` where `x` is SOL paid in and `y` is the coin balance held by the curve contract. Price rises geometrically as SOL accumulates. There is **no liquidity provider** — only one-way flows from buyers to the curve, and the curve back to sellers.

**Graduation.** When the curve has accumulated ~85 SOL (variable, see pump.fun docs), the contract migrates the pool to a Raydium AMM with the accumulated SOL as initial liquidity. Trading on the curve closes; trading on Raydium opens.

**Implications for "buy/sell now?" pre-graduation:**

- **Slippage is asymmetric.** Buying $1k of a coin at $30k market cap impacts price ~15%. Selling the same $1k impacts price ~13%. The curve's geometric shape punishes size in either direction.
- **There's no real top-10 holder data.** Until graduation, the curve contract holds most supply. Holder-distribution signals from Birdeye are misleading.
- **The dev's allocation matters more than the chart.** Look at whether the deployer wallet still holds tokens. Devs that dumped before graduation = coin almost certainly dies post-grad. Devs that bought back = bullish post-grad signal.
- **Graduation is the catalyst.** 80% of pump.fun coins die before graduation. The 20% that graduate enter Raydium with a 2-30 minute window of insane volatility — most of the round-trip alpha lives here.

**Cross-reference:** [[solana-memecoin-lifecycle]] for stage 1→2 transitions, [[volume-liquidity-ratio]] for post-grad sizing.
