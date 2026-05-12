---
slug: priority-fees-failed-tx
title: Priority fees and failed transactions during Solana pumps
tags: [solana, priority-fees, failed-tx, mev, execution]
---

Solana congestion shows up in two places that matter for trading: **failed transactions** and **slippage on confirmed transactions**. Both spike during memecoin pumps and major launches.

**Failed-tx rate.** During calm periods, the network rejects ~5-10% of tx. During pumps it can hit 60-70%. Failed swaps still cost SOL (rent + fee) but execute no trade. If you're paper-trading, this is invisible. If you're routing real flow, set `compute_unit_price` aggressively (5000-50000 micro-lamports per CU during congestion) or you'll watch every other tx fail while the price moves.

**Effective slippage.** Even confirmed swaps see worse fills under load — Jupiter's quoted route may execute against stale state. The 1% slippage tolerance most aggregators default to is often blown through during pumps. Set 3-5% during pumps; refuse the trade if it requires more (price is moving against you faster than you can transact).

**Signal value.** A spike in failed-tx rate on a specific pool is itself a signal: someone is trying very hard to get in or out. Helius webhooks on the pool address tell you this in near-real-time.

**Rule of thumb.** If `compute_unit_price` for landed tx is >20k micro-lamports and `tx_failure_rate` > 30%, the chain is in a "pump regime." Don't trust mean-reversion signals — momentum dominates.
