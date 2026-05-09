// TradeFish Arena — interactive prototype components.
// Loaded as Babel JSX. Uses window.TF and window.TFSwarm.

const { useState, useEffect, useRef, useMemo, useCallback } = React;
const TF = window.TF;

// ─── Sponsor mark ────────────────────────────────────────────────────────────
function SponsorMark({ sponsor, size = 11 }) {
  const s = TF.SPONSORS[sponsor];
  if (!s) return null;
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: size,
      letterSpacing: '0.14em',
      color: s.hue,
      padding: '3px 7px',
      border: '1px solid currentColor',
      borderRadius: 4,
      opacity: 0.9,
    }}>{s.mark}</span>
  );
}

// ─── Animated number ─────────────────────────────────────────────────────────
function AnimNum({ value, duration = 700, prefix = '', suffix = '', decimals = 2, style }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef(performance.now());
  const targetRef = useRef(value);

  useEffect(() => {
    fromRef.current = display;
    targetRef.current = value;
    startRef.current = performance.now();
    let raf;
    const step = (now) => {
      const t = Math.min(1, (now - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = fromRef.current + (targetRef.current - fromRef.current) * eased;
      setDisplay(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const sign = display > 0 && (prefix === '+' || prefix === '$+') ? '+' : '';
  const txt = `${prefix}${sign}${display.toFixed(decimals)}${suffix}`;
  return <span className="tf-num" style={style}>{txt}</span>;
}

// ─── Bracket badge ───────────────────────────────────────────────────────────
function BracketBadge({ bracket }) {
  const b = TF.BRACKETS[bracket];
  if (!b) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: b.color, padding: '3px 8px',
      border: '1px solid currentColor', borderRadius: 4, opacity: 0.9,
    }}>
      <span>{b.glyph}</span><span>{b.name}</span>
    </span>
  );
}

// ─── BTC Chart ───────────────────────────────────────────────────────────────
function PriceChart({ progress, agents, settled }) {
  // progress: 0..1 along the path
  const path = useMemo(() => TF.makePricePath(7, 300, 64200, 64650), []);
  const W = 760, H = 300, padL = 50, padR = 14, padT = 16, padB = 28;
  const innerW = W - padL - padR, innerH = H - padT - padB;

  const visiblePath = path.slice(0, Math.max(2, Math.floor(progress * path.length)));
  const minP = 64080, maxP = 64720;
  const xFor = (i, total) => padL + (i / Math.max(1, total - 1)) * innerW;
  const yFor = (p) => padT + (1 - (p - minP) / (maxP - minP)) * innerH;

  const lineD = visiblePath.map((pt, i) => {
    const x = xFor(i, path.length); // anchor against full path so it grows leftward-fixed
    const y = yFor(pt.price);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  const areaD = visiblePath.length > 1
    ? lineD + ` L${xFor(visiblePath.length - 1, path.length).toFixed(1)} ${(padT + innerH).toFixed(1)} L${xFor(0, path.length).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`
    : '';

  const lastPx = visiblePath[visiblePath.length - 1]?.price ?? 64200;
  const lastX = xFor(visiblePath.length - 1, path.length);
  const lastY = yFor(lastPx);

  // Y axis ticks
  const yTicks = [64100, 64300, 64500, 64700];

  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(120, 220, 255, 0.28)" />
          <stop offset="100%" stopColor="rgba(120, 220, 255, 0)" />
        </linearGradient>
        <filter id="lineGlow"><feGaussianBlur stdDeviation="2" /></filter>
      </defs>

      {/* Grid */}
      {yTicks.map((p) => (
        <g key={p}>
          <line x1={padL} x2={W - padR} y1={yFor(p)} y2={yFor(p)} stroke="rgba(120,180,230,0.06)" strokeDasharray="2 4" />
          <text x={padL - 8} y={yFor(p) + 3} textAnchor="end" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-faintest)">{p.toLocaleString()}</text>
        </g>
      ))}

      {/* Entry line at 64200 */}
      <line x1={padL} x2={W - padR} y1={yFor(64200)} y2={yFor(64200)} stroke="rgba(140,220,255,0.25)" strokeDasharray="3 3" />
      <text x={W - padR - 4} y={yFor(64200) - 4} textAnchor="end" fontFamily="var(--font-mono)" fontSize="9" fill="rgba(140,220,255,0.6)">ENTRY 64,200</text>

      {/* Settle target — only after settle */}
      {settled && (
        <>
          <line x1={padL} x2={W - padR} y1={yFor(64650)} y2={yFor(64650)} stroke="rgba(70,220,140,0.5)" strokeDasharray="3 3" />
          <text x={W - padR - 4} y={yFor(64650) - 4} textAnchor="end" fontFamily="var(--font-mono)" fontSize="9" fill="var(--long)">SETTLE 64,650</text>
        </>
      )}

      {/* Area */}
      {visiblePath.length > 1 && <path d={areaD} fill="url(#chartFill)" />}

      {/* Line glow + line */}
      {visiblePath.length > 1 && <path d={lineD} fill="none" stroke="rgba(140,220,255,0.6)" strokeWidth="3" filter="url(#lineGlow)" />}
      {visiblePath.length > 1 && <path d={lineD} fill="none" stroke="#a8e8ff" strokeWidth="1.5" />}

      {/* Live cursor */}
      {visiblePath.length > 1 && (
        <>
          <line x1={lastX} x2={lastX} y1={padT} y2={padT + innerH} stroke="rgba(140,220,255,0.3)" strokeDasharray="2 3" />
          <circle cx={lastX} cy={lastY} r="5" fill="#a8e8ff" />
          <circle cx={lastX} cy={lastY} r="10" fill="none" stroke="rgba(140,220,255,0.4)">
            <animate attributeName="r" from="6" to="14" dur="1.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.7" to="0" dur="1.4s" repeatCount="indefinite" />
          </circle>
          <rect x={lastX + 8} y={lastY - 14} width="80" height="22" rx="4" fill="rgba(8,16,28,0.85)" stroke="rgba(140,220,255,0.4)" />
          <text x={lastX + 48} y={lastY + 1} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill="#a8e8ff" fontWeight="600">{lastPx.toFixed(0)}</text>
        </>
      )}

      {/* Agent entry markers */}
      {agents.filter(a => a.entered).map((a, i) => {
        const x = xFor(Math.floor((a.enterProgress || 0) * path.length), path.length);
        const y = yFor(a.entryPrice);
        const isLong = a.prediction === 'LONG';
        const isShort = a.prediction === 'SHORT';
        const color = isLong ? 'var(--long)' : isShort ? 'var(--short)' : 'var(--hold)';
        return (
          <g key={a.id} opacity={a.opacity ?? 1}>
            {/* Arrow marker */}
            {(isLong || isShort) && (
              <polygon
                points={isLong ? `${x},${y - 8} ${x - 5},${y + 4} ${x + 5},${y + 4}` : `${x},${y + 8} ${x - 5},${y - 4} ${x + 5},${y - 4}`}
                fill={color}
                stroke={color} strokeWidth="0.5"
              />
            )}
            {a.prediction === 'HOLD' && (
              <rect x={x - 5} y={y - 5} width="10" height="10" fill="none" stroke={color} strokeWidth="1.5" />
            )}
            {/* Sponsor tag */}
            <rect x={x + 8} y={y - 9} width="58" height="16" rx="3" fill="rgba(8,16,28,0.85)" stroke={`var(--s-${a.sponsor})`} strokeOpacity="0.5" />
            <text x={x + 37} y={y + 2} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill={`var(--s-${a.sponsor})`} letterSpacing="0.08em">{TF.SPONSORS[a.sponsor].mark}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Agent Card ──────────────────────────────────────────────────────────────
function AgentCard({ agent, phase, settledAgent, rewardAgent }) {
  const isLong = agent.prediction === 'LONG';
  const isShort = agent.prediction === 'SHORT';
  const dirColor = isLong ? 'var(--long)' : isShort ? 'var(--short)' : 'var(--hold)';
  const dirGlow = isLong ? 'tf-glow-long' : isShort ? 'tf-glow-short' : '';
  const sponsor = TF.SPONSORS[agent.sponsor];

  const showSettle = phase >= 4 && settledAgent;
  const showReward = phase >= 5 && rewardAgent;
  const pnl = settledAgent?.roundPnl ?? 0;
  const reward = rewardAgent?.rewardUsdc ?? 0;

  return (
    <div className="tf-card" style={{
      padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
      borderColor: agent.entered ? sponsor.hue : 'var(--line)',
      transition: 'border-color 0.4s ease',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* sponsor accent strip */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: sponsor.hue, opacity: agent.entered ? 0.7 : 0.2, transition: 'opacity 0.4s' }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SponsorMark sponsor={agent.sponsor} />
          <BracketBadge bracket={agent.bracket} />
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-faint)', letterSpacing: '0.1em' }}>
          #{agent.rank}
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>{agent.name}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-faint)', letterSpacing: '0.08em', marginTop: 2 }}>{agent.role.toUpperCase()}</div>
      </div>

      {!agent.entered && phase < 2 && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-faintest)', padding: '14px 0', textAlign: 'center', letterSpacing: '0.1em' }}>
          AWAITING SIGNAL<span className="tf-caret" style={{ height: '0.7em' }}></span>
        </div>
      )}

      {agent.entered && (
        <>
          <div className={dirGlow} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 10px', borderRadius: 8,
            background: isLong ? 'var(--long-bg)' : isShort ? 'var(--short-bg)' : 'rgba(255,200,80,0.08)',
            border: `1px solid ${dirColor}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: dirColor, letterSpacing: '0.06em' }}>{agent.prediction}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-dim)' }}>{agent.confidence}% conf</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-faint)', fontVariantNumeric: 'tabular-nums' }}>
              ${agent.positionSizeUsd}
            </div>
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--fg-dim)', lineHeight: 1.45 }}>
            {agent.thesis}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-faint)', borderTop: '1px solid var(--line)', paddingTop: 8 }}>
            <span>ENTRY <span style={{ color: 'var(--fg-dim)' }}>{agent.entryPrice.toLocaleString()}</span></span>
            {agent.targetPrice && <span>TGT <span style={{ color: 'var(--long)' }}>{agent.targetPrice.toLocaleString()}</span></span>}
            {agent.stopPrice && <span>STOP <span style={{ color: 'var(--short)' }}>{agent.stopPrice.toLocaleString()}</span></span>}
          </div>

          {showSettle && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 10px', marginTop: 2,
              background: pnl >= 0 ? 'var(--long-bg)' : 'var(--short-bg)',
              border: `1px solid ${pnl >= 0 ? 'var(--long)' : 'var(--short)'}`,
              borderRadius: 6,
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--fg-faint)' }}>ROUND PnL</span>
              <AnimNum
                value={pnl}
                prefix="$"
                decimals={2}
                style={{ color: pnl >= 0 ? 'var(--long)' : 'var(--short)', fontSize: 14, fontWeight: 600 }}
              />
            </div>
          )}

          {showReward && reward > 0 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 10px',
              background: 'rgba(140, 220, 255, 0.06)',
              border: '1px solid rgba(140, 220, 255, 0.3)',
              borderRadius: 6,
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--cyan)' }}>FEE REWARD</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--cyan)' }}>
                <AnimNum value={reward} decimals={2} suffix=" USDC" />
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Consensus Panel ─────────────────────────────────────────────────────────
function ConsensusPanel({ phase, agents }) {
  const visible = phase >= 3;
  const enteredAgents = agents.filter(a => a.entered);

  // Weighted vote calculation
  const weights = useMemo(() => {
    let long = 0, short = 0, hold = 0;
    enteredAgents.forEach(a => {
      const mult = TF.BRACKETS[a.bracket].mult;
      const w = a.confidence * mult;
      if (a.prediction === 'LONG') long += w;
      else if (a.prediction === 'SHORT') short += w;
      else hold += w;
    });
    return { long, short, hold };
  }, [enteredAgents]);

  const total = weights.long + weights.short + weights.hold || 1;
  const longPct = (weights.long / total) * 100;
  const shortPct = (weights.short / total) * 100;
  const holdPct = (weights.hold / total) * 100;
  const direction = weights.long > weights.short && weights.long > weights.hold ? 'LONG'
    : weights.short > weights.hold ? 'SHORT' : 'HOLD';
  const confidence = Math.round((weights[direction.toLowerCase()] / total) * 100);
  const dirColor = direction === 'LONG' ? 'var(--long)' : direction === 'SHORT' ? 'var(--short)' : 'var(--hold)';

  return (
    <div className="tf-card" style={{
      padding: 18, opacity: visible ? 1 : 0.4,
      transition: 'opacity 0.5s ease',
      borderColor: visible ? 'var(--line-bright)' : 'var(--line)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', color: 'var(--fg-faint)' }}>WEIGHTED CONSENSUS</div>
          <div style={{ fontSize: 11, color: 'var(--fg-faintest)', marginTop: 2 }}>vote × confidence × pnl-bracket multiplier</div>
        </div>
        {visible && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 600, color: dirColor, letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>{direction}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-dim)' }}>{confidence}% confidence</div>
          </div>
        )}
      </div>

      {/* Stacked weighted bar */}
      <div style={{ height: 10, borderRadius: 4, overflow: 'hidden', display: 'flex', background: 'rgba(255,255,255,0.04)' }}>
        <div style={{ width: `${longPct}%`, background: 'var(--long)', transition: 'width 0.6s ease' }} />
        <div style={{ width: `${holdPct}%`, background: 'var(--hold)', opacity: 0.7, transition: 'width 0.6s ease' }} />
        <div style={{ width: `${shortPct}%`, background: 'var(--short)', transition: 'width 0.6s ease' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        <span style={{ color: 'var(--long)' }}>▲ LONG {longPct.toFixed(0)}% <span style={{ color: 'var(--fg-faint)' }}>· w {weights.long.toFixed(0)}</span></span>
        <span style={{ color: 'var(--hold)' }}>◼ HOLD {holdPct.toFixed(0)}%</span>
        <span style={{ color: 'var(--short)' }}>▼ SHORT {shortPct.toFixed(0)}%</span>
      </div>

      <div style={{ marginTop: 14, padding: 10, border: '1px solid var(--line)', borderRadius: 6, fontSize: 12, color: 'var(--fg-dim)', lineHeight: 1.5 }}>
        <span style={{ color: 'var(--cyan)', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Flock summary · </span>
        High-PnL agents (Whale + Gold tier) lean {direction}. {direction === 'LONG' ? 'Onchain flow + execution timing aligned bullish.' : 'Defensive bias dominates.'} Risk: <span style={{ color: 'var(--amber)' }}>MEDIUM</span>.
      </div>
    </div>
  );
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────
function Leaderboard({ phase, agents, settledAgents }) {
  const ranked = phase >= 4 && settledAgents
    ? [...settledAgents].sort((a, b) => b.totalPnlAfter - a.totalPnlAfter)
    : [...agents].sort((a, b) => b.totalPnl - a.totalPnl);

  return (
    <div className="tf-card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', color: 'var(--fg-faint)' }}>LIVE PnL LEADERBOARD</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-faintest)' }}>RANK · TOTAL PnL · BRACKET</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {ranked.map((a, i) => {
          const totalPnl = phase >= 4 && a.totalPnlAfter !== undefined ? a.totalPnlAfter : a.totalPnl;
          const delta = phase >= 4 && a.roundPnl !== undefined ? a.roundPnl : 0;
          return (
            <div key={a.id} style={{
              display: 'grid', gridTemplateColumns: '28px 28px 1fr auto auto',
              gap: 10, alignItems: 'center',
              padding: '7px 8px', borderRadius: 6,
              background: i === 0 ? 'rgba(140,220,255,0.04)' : 'transparent',
              border: i === 0 ? '1px solid rgba(140,220,255,0.18)' : '1px solid transparent',
              transition: 'background 0.4s, border 0.4s',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: i === 0 ? 'var(--cyan)' : 'var(--fg-faint)' }}>#{i + 1}</span>
              <SponsorMark sponsor={a.sponsor} size={9} />
              <span style={{ fontSize: 12, color: 'var(--fg)' }}>{a.name}</span>
              {delta !== 0 && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: delta >= 0 ? 'var(--long)' : 'var(--short)' }}>
                  {delta >= 0 ? '+' : ''}{delta.toFixed(2)}
                </span>
              )}
              {delta === 0 && <span></span>}
              <span className="tf-num" style={{ fontSize: 12, color: totalPnl >= 0 ? 'var(--fg)' : 'var(--short)', minWidth: 60, textAlign: 'right' }}>
                {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Fee Distribution ────────────────────────────────────────────────────────
function FeePanel({ phase, rewardAgents }) {
  const visible = phase >= 5;
  const winners = (rewardAgents || []).filter(a => a.rewardUsdc > 0).sort((a, b) => b.rewardUsdc - a.rewardUsdc);
  const protocolFee = TF.FEE_POOL - TF.AGENT_REWARD_POOL;

  return (
    <div className="tf-card" style={{
      padding: 16, opacity: visible ? 1 : 0.45,
      transition: 'opacity 0.5s',
      borderColor: visible ? 'var(--line-bright)' : 'var(--line)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', color: 'var(--fg-faint)' }}>FEE DISTRIBUTION · BASE USDC</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cyan)' }}>{TF.FEE_POOL.toFixed(2)} USDC POOL</span>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, padding: 10, border: '1px solid var(--line)', borderRadius: 6 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em', color: 'var(--fg-faint)' }}>PROTOCOL · 20%</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--fg)', marginTop: 2 }}>{protocolFee.toFixed(2)} USDC</div>
        </div>
        <div style={{ flex: 1, padding: 10, border: '1px solid var(--cyan)', borderRadius: 6, background: 'rgba(140,220,255,0.05)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em', color: 'var(--cyan)' }}>AGENTS · 80%</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--cyan)', marginTop: 2 }}>{TF.AGENT_REWARD_POOL.toFixed(2)} USDC</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visible && winners.map((a, i) => (
          <div key={a.id} style={{
            display: 'grid', gridTemplateColumns: '60px 1fr auto auto', gap: 10, alignItems: 'center',
            padding: '6px 0',
          }}>
            <SponsorMark sponsor={a.sponsor} size={9} />
            <span style={{ fontSize: 12, color: 'var(--fg-dim)' }}>{a.name}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-faint)' }}>{a.rewardShare.toFixed(0)}%</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--cyan)', fontWeight: 600 }}>
              <AnimNum value={a.rewardUsdc} decimals={2} suffix=" USDC" />
            </span>
          </div>
        ))}
        {!visible && (
          <div style={{ padding: '24px 0', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-faintest)', letterSpacing: '0.1em' }}>
            AWAITING SETTLEMENT<span className="tf-caret" style={{ height: '0.7em' }}></span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Phase Stepper ───────────────────────────────────────────────────────────
function PhaseStepper({ phase }) {
  const steps = ['Question', 'Predictions', 'Consensus', 'Settle', 'Rewards'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {steps.map((s, i) => {
        const active = phase >= i + 1;
        const current = phase === i + 1;
        return (
          <React.Fragment key={s}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 999,
              border: `1px solid ${current ? 'var(--cyan)' : active ? 'var(--line-strong)' : 'var(--line)'}`,
              background: current ? 'rgba(140,220,255,0.08)' : 'transparent',
              transition: 'all 0.3s',
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: 50,
                background: current ? 'var(--cyan)' : active ? 'var(--fg-dim)' : 'var(--fg-faintest)',
                boxShadow: current ? '0 0 8px var(--cyan)' : 'none',
              }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: current ? 'var(--cyan)' : active ? 'var(--fg-dim)' : 'var(--fg-faintest)' }}>{i + 1}. {s}</span>
            </div>
            {i < steps.length - 1 && <div style={{ width: 12, height: 1, background: 'var(--line)' }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

Object.assign(window, {
  SponsorMark, AnimNum, BracketBadge, PriceChart,
  AgentCard, ConsensusPanel, Leaderboard, FeePanel, PhaseStepper,
});
