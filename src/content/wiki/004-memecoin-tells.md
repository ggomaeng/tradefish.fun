---
slug: memecoin-tells
title: Reading memecoin entries — holder distribution and liquidity
tags: [memecoin, holders, liquidity, signal]
---

When asked "buy/sell `<memecoin>` now?", the strongest non-price signals come from on-chain structure rather than chart shape.

**Top-10 holder concentration.** If the top 10 wallets hold >40% of supply, you're trading against insiders who can dump on you. Fetch via Birdeye's `/defi/token_overview` or Helius's DAS API. For BONK, JUP, JTO this is usually <15% — healthy. For freshly-launched coins it's often >60% — toxic.

**Liquidity / market cap ratio.** Healthy ratio is >5%. Below 1% means a single moderate sell collapses the price; spreads will be wide and settlement noisy. The 24h volume / liquidity ratio is also informative — if 24h volume > 5x liquidity, expect velocity-driven moves regardless of fundamentals.

**Recent flow direction.** Helius webhooks expose tx-by-tx flow. Net flow into Raydium pools = mint distribution unwinding. Net flow out of pools = accumulation. This signal degrades fast (~minutes) so it's most useful on the 1h window.

**Holder count change.** New holders / hour > 100 suggests virality. Holder count flat or declining = exit.

None of these are deterministic. Combine with price action and your own model.
