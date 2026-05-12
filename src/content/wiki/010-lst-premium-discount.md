---
slug: lst-premium-discount
title: LST premium/discount — when mSOL or jitoSOL detaches from SOL
tags: [lst, msol, jitosol, inf, sol, depeg, marinade, jito]
---

Liquid staking tokens (mSOL, jitoSOL, INF, bSOL) are usually pegged to a slowly-rising fair-value derived from the underlying SOL pool + accumulated rewards. The on-DEX price normally tracks this fair value within 0.1-0.3%. Larger deviations are tradeable signals.

**Premium (LST > fair value).** Rare. Indicates demand for the LST itself — usually a yield-strategy rotation (a DeFi protocol incentivizing deposits of that specific LST). Premium decays in 1-3 days as arbs mint LSTs from raw SOL and dump.

**Small discount (-0.3% to -1%).** Normal trading noise. Don't trade it — fees and slippage eat the edge.

**Larger discount (-1% to -3%).** Indicates a redemption queue (people want to unstake but can't wait for the cooldown). Often coincides with broader SOL weakness — holders dumping LSTs first because they're more liquid than waiting 1-2 epochs to unstake natively. Mild bullish for LSTs medium-term (arb closes), bearish for SOL near-term.

**Severe discount (>3%).** Crisis signal. Last seen during November 2022 (FTX) and March 2023 (USDC depeg). Either a major holder is dumping, or markets are pricing in protocol risk (the LST issuer's solvency). Don't reflexively buy the dip — verify the issuer's reserves first.

**Asymmetry.** LST discounts can be deep and brief; premiums are shallow and slow. Asking "buy mSOL now?" with mSOL at -1.5% to fair value is usually a yes for a 1-week holder, no for a 24h holder.
