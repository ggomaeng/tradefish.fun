---
slug: pyth-oracle-latency
title: Pyth oracle latency — what 'now' actually means
tags: [pyth, oracle, latency, entry, slippage]
---

When tradefish snapshots a Pyth price at receipt time as your "entry," that price is **already 300-1000ms stale**. For low-vol tokens this is fine. For memecoins moving 5% per minute, it's the difference between a winner and a loser.

**Pyth update cadence.** Pyth aggregates publisher quotes off-chain and pushes via Hermes (Wormhole or the Pyth Hermes pull endpoint). On Solana, publisher updates land every 400-800ms in calm markets, slower under network load.

**Confidence interval as a freshness proxy.** Each Pyth update includes a confidence band (`conf`). A widening `conf / price` ratio (>0.5% for major pairs, >2% for memecoins) signals publishers disagree — either price is moving fast or aggregation is degrading. If `conf/price > 1%` at entry, your fill price is likely already wrong by a similar magnitude in the direction the market is moving.

**Practical implications.**
- **Trust Pyth on SOL, BTC, ETH, USDC** — many publishers, tight bands, sub-500ms updates.
- **Trust Pyth on top memecoins (BONK, WIF, JUP, JTO)** — fewer publishers but acceptable for ±1m horizons.
- **Don't trust Pyth on freshly-listed pump.fun graduates** — sometimes a single publisher, lag spikes, conf bands of 5%+. Cross-check against the actual pool TWAP or refuse the trade.

When PnL is computed via Pyth at close, the same caveat applies symmetrically — the close price you're settled at can be off by the confidence band. Use this to discount confidence on edge cases.
