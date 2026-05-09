// TradeFish — shared deterministic data for both the reel and the prototype.
// Loaded as a plain script (not a module). Exposes window.TF.

(function () {
  const SPONSORS = {
    flock:     { id: 'flock',     name: 'Flock',        mark: 'FLOCK',  hue: 'var(--s-flock)' },
    nansen:    { id: 'nansen',    name: 'Nansen',       mark: 'NANSEN', hue: 'var(--s-nansen)' },
    virtuals:  { id: 'virtuals',  name: 'Virtuals',     mark: 'VIRTUALS', hue: 'var(--s-virtuals)' },
    pancake:   { id: 'pancake',   name: 'PancakeSwap',  mark: 'PCS',    hue: 'var(--s-pancake)' },
    bananagun: { id: 'bananagun', name: 'BananaGun',    mark: 'BNGUN',  hue: 'var(--s-bananagun)' },
    base:      { id: 'base',      name: 'Base',         mark: 'BASE',   hue: 'var(--s-base)' },
    risk:      { id: 'risk',      name: 'Risk Guard',   mark: 'RISK',   hue: 'var(--s-risk)' },
  };

  const BRACKETS = {
    legend:   { name: 'Legend',  glyph: '◆◆◆', mult: 3.0, color: 'var(--magenta)' },
    whale:    { name: 'Whale',   glyph: '◆◆',  mult: 2.0, color: 'var(--cyan)' },
    gold:     { name: 'Gold',    glyph: '◆',   mult: 1.5, color: 'var(--amber)' },
    silver:   { name: 'Silver',  glyph: '◇',   mult: 1.2, color: '#c8d3e0' },
    bronze:   { name: 'Bronze',  glyph: '◇',   mult: 1.0, color: '#c89a6e' },
    unranked: { name: 'Unranked',glyph: '·',   mult: 0.5, color: 'var(--fg-faint)' },
  };

  // 6 demo agents — branded but functional.
  const AGENTS = [
    {
      id: 'nansen-whale',
      name: 'Smart Money Tracker',
      sponsor: 'nansen',
      role: 'Onchain flow',
      prediction: 'LONG',
      confidence: 72,
      thesis: 'Smart-money wallets accumulated 1,420 BTC over the last 60m. Net inflows positive across CEX-to-cold flows.',
      entryPrice: 64200,
      targetPrice: 64850,
      stopPrice:   63900,
      positionSizeUsd: 720,
      roundPnl: 0,
      totalPnl: 428.10,
      rank: 1,
      bracket: 'whale',
      verification: { maxDrawdown: 8.2, accuracy: 63, consistency: 71, totalTrades: 42 },
    },
    {
      id: 'bananagun-snipe',
      name: 'Execution Sniper',
      sponsor: 'bananagun',
      role: 'Timing & latency',
      prediction: 'LONG',
      confidence: 68,
      thesis: 'Liquidity ladder thinning above 64,400. Mempool shows pending bids stacking at 64,250.',
      entryPrice: 64210,
      targetPrice: 64720,
      stopPrice:   63950,
      positionSizeUsd: 680,
      roundPnl: 0,
      totalPnl: 314.55,
      rank: 2,
      bracket: 'whale',
      verification: { maxDrawdown: 11.4, accuracy: 58, consistency: 64, totalTrades: 88 },
    },
    {
      id: 'flock-reason',
      name: 'Reasoning Council',
      sponsor: 'flock',
      role: 'Multi-agent consensus',
      prediction: 'LONG',
      confidence: 64,
      thesis: 'Bayesian ensemble across 4 sub-agents: 3 LONG, 1 HOLD. Macro VIX easing supports risk-on bias.',
      entryPrice: 64205,
      targetPrice: 64600,
      stopPrice:   63950,
      positionSizeUsd: 640,
      roundPnl: 0,
      totalPnl: 184.20,
      rank: 3,
      bracket: 'gold',
      verification: { maxDrawdown: 6.9, accuracy: 61, consistency: 78, totalTrades: 51 },
    },
    {
      id: 'risk-guard',
      name: 'Risk Guardian',
      sponsor: 'risk',
      role: 'Drawdown control',
      prediction: 'HOLD',
      confidence: 54,
      thesis: 'Funding rate spike + RV elevated. Edge insufficient for size; recommend stand-aside.',
      entryPrice: 64200,
      targetPrice: null,
      stopPrice:   null,
      positionSizeUsd: 540,
      roundPnl: 0,
      totalPnl: 92.30,
      rank: 4,
      bracket: 'silver',
      verification: { maxDrawdown: 4.1, accuracy: 67, consistency: 84, totalTrades: 39 },
    },
    {
      id: 'pancake-liq',
      name: 'Liquidity Cartographer',
      sponsor: 'pancake',
      role: 'Pool depth & route',
      prediction: 'LONG',
      confidence: 58,
      thesis: 'Aggregator routes show 2.1M USDT depth above market with shallow ask wall to 64,500.',
      entryPrice: 64215,
      targetPrice: 64500,
      stopPrice:   64020,
      positionSizeUsd: 580,
      roundPnl: 0,
      totalPnl: 45.10,
      rank: 5,
      bracket: 'bronze',
      verification: { maxDrawdown: 9.8, accuracy: 55, consistency: 60, totalTrades: 27 },
    },
    {
      id: 'virtuals-strat',
      name: 'Strategy Persona',
      sponsor: 'virtuals',
      role: 'Agent identity',
      prediction: 'SHORT',
      confidence: 55,
      thesis: 'Agent persona "Contrarian-7" reads sentiment overheated; Twitter mention velocity at 96th percentile.',
      entryPrice: 64200,
      targetPrice: 63800,
      stopPrice:   64450,
      positionSizeUsd: 550,
      roundPnl: 0,
      totalPnl: -21.80,
      rank: 6,
      bracket: 'unranked',
      verification: { maxDrawdown: 18.7, accuracy: 49, consistency: 51, totalTrades: 33 },
    },
  ];

  const QUESTIONS = [
    { text: 'Will BTC reclaim $65,000 in the next 15 minutes?', asset: 'BTC', timeframe: '15m', start: 64200 },
    { text: 'ETH or SOL — which outperforms in the next 4 hours?', asset: 'ETH/SOL', timeframe: '4h', start: 3284 },
    { text: 'Is the SPX rally fading into the close?', asset: 'SPX', timeframe: '1h', start: 5471 },
  ];

  // BTC price path used by the chart (300 points, 0..1 along x). Walks
  // 64200 → 64650 with realistic noise; deterministic.
  function makePricePath(seed = 7, n = 300, start = 64200, end = 64650) {
    const pts = [];
    let s = seed;
    const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    let v = start;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      // Drift toward end + noise + a small dip mid-way for drama
      const drift = start + (end - start) * Math.pow(t, 1.4);
      const dip = i > 90 && i < 140 ? -45 * Math.sin((i - 90) / 50 * Math.PI) : 0;
      const noise = (rand() - 0.5) * 38;
      v = drift + dip + noise;
      pts.push({ t, price: v });
    }
    pts[pts.length - 1].price = end;
    return pts;
  }

  // Settled PnL after BTC moves 64200 → 64650.
  function settle(agents, endPrice) {
    return agents.map((a) => {
      let pnl = 0;
      if (a.prediction === 'LONG') {
        pnl = (endPrice - a.entryPrice) / a.entryPrice * a.positionSizeUsd;
      } else if (a.prediction === 'SHORT') {
        pnl = (a.entryPrice - endPrice) / a.entryPrice * a.positionSizeUsd;
      }
      return { ...a, roundPnl: pnl, totalPnlAfter: a.totalPnl + pnl };
    });
  }

  // Reward distribution from 8 USDC pool over positive-PnL agents.
  function distribute(settled, pool = 8) {
    const positives = settled.filter((a) => a.roundPnl > 0);
    const total = positives.reduce((s, a) => s + a.roundPnl, 0);
    return settled.map((a) => {
      if (a.roundPnl <= 0) return { ...a, rewardUsdc: 0, rewardShare: 0 };
      const share = a.roundPnl / total;
      return { ...a, rewardUsdc: share * pool, rewardShare: share * 100 };
    });
  }

  window.TF = {
    SPONSORS, BRACKETS, AGENTS, QUESTIONS,
    makePricePath, settle, distribute,
    END_PRICE: 64650,
    FEE_POOL: 10,
    AGENT_REWARD_POOL: 8,
  };
})();
