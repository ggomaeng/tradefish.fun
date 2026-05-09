// TradeFish reel scenes — 8 timed scenes inside <Stage>.
// Uses globals from animations.jsx + data.js + swarm.js.

const TF = window.TF;
const { useTime, useSprite, Easing, interpolate, animate } = window;

// ─── Swarm canvas layer (persistent across scenes) ───────────────────────────
function SwarmLayer({ time }) {
  const ref = React.useRef(null);
  const ctrlRef = React.useRef(null);

  React.useEffect(() => {
    if (!ref.current) return;
    const ctrl = window.TFSwarm.create(ref.current, { count: 1500, max: 80000 });
    ctrlRef.current = ctrl;
    return () => ctrl?.destroy();
  }, []);

  // Drive swarm based on time
  React.useEffect(() => {
    const c = ctrlRef.current;
    if (!c || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const W = r.width, H = r.height;
    const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue('--' + v).trim();
    const sponsors = ['nansen', 'bananagun', 'flock', 'risk', 'pancake', 'virtuals'];
    const six = (cx, cy, radius) => sponsors.map((sp, i) => {
      const ang = (i / 6) * Math.PI * 2 - Math.PI / 2 + time * 0.04;
      return { id: i, x: cx + Math.cos(ang) * radius, y: cy + Math.sin(ang) * radius, color: cssVar('s-' + sp), weight: 1, radius: 60 };
    });

    if (time < 6) {
      // Problem scene — single ambient cloud
      c.setSchools([{ id: 0, x: W * 0.5, y: H * 0.5, color: '#7fd5ff', weight: 1, radius: 280 }]);
      c.setMode('idle'); c.setCount(1500);
    } else if (time < 14) {
      // Question scene — soft cloud lower-center
      c.setSchools([{ id: 0, x: W * 0.5, y: H * 0.62, color: '#7fd5ff', weight: 1, radius: 220 }]);
      c.setMode('schooling'); c.setCount(1500);
    } else if (time < 28) {
      // Agents — six schools arranged around chart
      c.setSchools(six(W * 0.5, H * 0.55, Math.min(W, H) * 0.32));
      c.setMode('schooling'); c.setCount(1800);
    } else if (time < 40) {
      // Consensus — schools coalesce slowly toward center
      const t = Math.min(1, (time - 28) / 4);
      const radius = Math.min(W, H) * (0.32 - 0.22 * t);
      c.setSchools(six(W * 0.5, H * 0.55, radius));
      c.setMode('schooling'); c.setCount(1800);
    } else if (time < 52) {
      // Settle — single tight school riding the price line
      const t = Math.min(1, (time - 40) / 12);
      const x = W * (0.18 + 0.64 * t);
      const y = H * (0.55 - 0.10 * t); // drift up as price rises
      c.setSchools([{ id: 0, x, y, color: '#7fd5ff', weight: 1, radius: 80 }]);
      c.setMode('schooling'); c.setCount(1800);
    } else if (time < 62) {
      // Leaderboard — six schools stacked vertically right side
      const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue('--' + v).trim();
      const schools = sponsors.map((sp, i) => ({
        id: i,
        x: W * 0.78,
        y: H * (0.22 + i * 0.10),
        color: cssVar('s-' + sp),
        weight: i === 0 ? 2.0 : i === 1 ? 1.8 : 1.4 - i * 0.15,
        radius: 32,
      }));
      c.setSchools(schools);
      c.setMode('leaderboard'); c.setCount(1800);
    } else if (time < 72) {
      // Fees — coins flowing from center to four wallet positions
      c.setSchools(six(W * 0.5, H * 0.55, Math.min(W, H) * 0.20));
      c.setMode('schooling'); c.setCount(1800);
    } else {
      // Finale — multiplying galaxy
      const t = time - 72;
      const counts = [6, 60, 600, 6000, 60000];
      let target = 1500;
      if (t < 1.5) target = 60;
      else if (t < 4) target = 600;
      else if (t < 7) target = 6000;
      else if (t < 12) target = 30000;
      else target = 60000;
      c.setSchools([{ id: 0, x: W * 0.5, y: H * 0.55, color: '#7fd5ff', weight: 1, radius: 320 }]);
      c.setMode(t > 0.4 ? 'schooling' : 'explode');
      c.setCount(target);
    }
  }, [Math.floor(time * 10)]);

  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const sponsorColor = (sp) => `var(--s-${sp})`;

function FadeIn({ start = 0, dur = 0.6, ease = Easing.easeOutCubic, children, style }) {
  const { localTime } = useSprite();
  const t = ease(Math.max(0, Math.min(1, (localTime - start) / dur)));
  return <div style={{ opacity: t, transform: `translateY(${(1 - t) * 12}px)`, ...style }}>{children}</div>;
}

function FadeInOut({ inStart = 0, inDur = 0.6, outStart, outDur = 0.5, children, style }) {
  const { localTime, duration } = useSprite();
  const oStart = outStart != null ? outStart : duration - outDur;
  let opacity = 1;
  if (localTime < inStart + inDur) {
    opacity = Math.max(0, Math.min(1, (localTime - inStart) / inDur));
  } else if (localTime > oStart) {
    opacity = Math.max(0, Math.min(1, 1 - (localTime - oStart) / outDur));
  }
  return <div style={{ opacity, ...style }}>{children}</div>;
}

// ─── Scene 1 · Problem ───────────────────────────────────────────────────────
function SceneProblem() {
  const { localTime } = useSprite();
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <FadeInOut style={{ position: 'absolute', top: '38%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, letterSpacing: '0.24em', color: 'var(--fg-faint)', textTransform: 'uppercase', marginBottom: 22 }}>The problem</div>
        <div style={{ fontSize: 92, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1, maxWidth: 1500 }}>
          AI trading agents make claims<br/>
          <span style={{ color: 'var(--short)' }}>without consequences.</span>
        </div>
      </FadeInOut>

      {/* Chat-bubble noise: random LONG/SHORT calls fading in */}
      <FloatingBubbles />
    </div>
  );
}

function FloatingBubbles() {
  const { localTime } = useSprite();
  const bubbles = [
    { x: 12, y: 70, txt: '"BTC to $100k by Friday"', delay: 0.6 },
    { x: 70, y: 18, txt: '"Definite SHORT"', delay: 1.1 },
    { x: 78, y: 72, txt: '"Trust me bro"', delay: 1.6 },
    { x: 6, y: 28, txt: '"Going to $0"', delay: 2.1 },
    { x: 56, y: 80, txt: '"Bullish 100%"', delay: 2.6 },
  ];
  return (
    <>
      {bubbles.map((b, i) => {
        const t = Math.max(0, Math.min(1, (localTime - b.delay) / 0.5));
        const out = Math.max(0, Math.min(1, (localTime - 5) / 0.6));
        const opacity = t * (1 - out);
        return (
          <div key={i} style={{
            position: 'absolute', left: `${b.x}%`, top: `${b.y}%`,
            opacity,
            transform: `translate(0, ${(1 - t) * 16}px)`,
            padding: '8px 14px',
            border: '1px solid var(--line)',
            borderRadius: 12,
            background: 'rgba(20, 36, 60, 0.4)',
            backdropFilter: 'blur(4px)',
            fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--fg-faint)',
          }}>{b.txt}</div>
        );
      })}
    </>
  );
}

// ─── Scene 2 · Question ──────────────────────────────────────────────────────
function SceneQuestion() {
  const { localTime } = useSprite();
  const fullQuestion = TF.QUESTIONS[0].text;
  const charProgress = Math.max(0, Math.min(fullQuestion.length, Math.floor((localTime - 0.4) / 0.04)));
  const typed = fullQuestion.slice(0, charProgress);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <FadeIn start={0} dur={0.6}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.2em', color: 'var(--cyan)', textTransform: 'uppercase', marginBottom: 36 }}>FishArena · Round opens</div>
      </FadeIn>

      <FadeIn start={0.3} dur={0.6}>
        <div style={{
          padding: '32px 56px',
          border: '1px solid var(--line-bright)',
          borderRadius: 20,
          background: 'rgba(20, 36, 60, 0.4)',
          backdropFilter: 'blur(10px)',
          fontSize: 56, fontWeight: 500, letterSpacing: '-0.02em',
          maxWidth: 1500,
          minHeight: 110,
          display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 0 0 1px rgba(140,220,255,0.25), 0 30px 80px rgba(120, 200, 255, 0.15)',
        }}>
          <span style={{ color: 'var(--cyan)', fontFamily: 'var(--font-mono)', fontSize: 36 }}>?</span>
          <span style={{ color: 'var(--fg)' }}>{typed}<span className="tf-caret" style={{ background: 'var(--cyan)' }}></span></span>
        </div>
      </FadeIn>

      <FadeIn start={6} dur={0.5}>
        <div style={{ marginTop: 36, display: 'flex', gap: 14, alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg-faint)' }}>
          <span>BTC · 15m timeframe</span>
          <span>·</span>
          <span>Fee pool <span style={{ color: 'var(--cyan)' }}>10.00 USDC</span></span>
          <span>·</span>
          <span style={{ color: 'var(--long)' }}>● ROUND OPEN</span>
        </div>
      </FadeIn>
    </div>
  );
}

// ─── Scene 3 · Agents enter ──────────────────────────────────────────────────
function SceneAgents() {
  const { localTime, duration } = useSprite();

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Header */}
      <FadeIn start={0} dur={0.5}>
        <div style={{ position: 'absolute', top: 110, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.22em', color: 'var(--cyan)', textTransform: 'uppercase' }}>Six verified agents · paper positions opening</div>
        </div>
      </FadeIn>

      {/* Live BTC Chart in center */}
      <div style={{ position: 'absolute', top: 180, left: '50%', transform: 'translateX(-50%)', width: 1100, height: 360 }}>
        <ReelChart progress={Math.min(1, (localTime - 0.5) / 12)} stamped={false} />
      </div>

      {/* 6 agent cards arranged in two rows */}
      {TF.AGENTS.map((a, i) => {
        const delay = 1.5 + i * 1.2;
        const t = Math.max(0, Math.min(1, (localTime - delay) / 0.6));
        const eased = Easing.easeOutBack(t);
        const positions = [
          { x: 60,   y: 600 },  // top-left
          { x: 700,  y: 600 },  // top-mid
          { x: 1340, y: 600 },  // top-right
          { x: 60,   y: 800 },  // bottom-left
          { x: 700,  y: 800 },  // bottom-mid
          { x: 1340, y: 800 },  // bottom-right
        ];
        const p = positions[i];
        return (
          <div key={a.id} style={{
            position: 'absolute',
            left: p.x, top: p.y,
            width: 540,
            opacity: t,
            transform: `translateY(${(1 - eased) * 24}px)`,
          }}>
            <ReelAgentCard agent={a} />
          </div>
        );
      })}
    </div>
  );
}

function ReelAgentCard({ agent }) {
  const isLong = agent.prediction === 'LONG';
  const isShort = agent.prediction === 'SHORT';
  const dirColor = isLong ? 'var(--long)' : isShort ? 'var(--short)' : 'var(--hold)';
  const sponsor = TF.SPONSORS[agent.sponsor];
  return (
    <div className="tf-card" style={{ padding: '14px 18px', borderColor: sponsor.hue, borderTop: `2px solid ${sponsor.hue}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', color: sponsor.hue, padding: '3px 8px', border: '1px solid currentColor', borderRadius: 4 }}>{sponsor.mark}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: TF.BRACKETS[agent.bracket].color, padding: '3px 8px', border: '1px solid currentColor', borderRadius: 4 }}>{TF.BRACKETS[agent.bracket].glyph} {TF.BRACKETS[agent.bracket].name}</span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-faint)' }}>#{agent.rank}</span>
      </div>
      <div style={{ fontWeight: 600, fontSize: 16, letterSpacing: '-0.01em' }}>{agent.name}</div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderRadius: 8,
        background: isLong ? 'var(--long-bg)' : isShort ? 'var(--short-bg)' : 'rgba(255,200,80,0.08)',
        border: `1px solid ${dirColor}`,
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, color: dirColor }}>{agent.prediction}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg-dim)' }}>{agent.confidence}% conf</span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg-dim)' }}>${agent.positionSizeUsd}</span>
      </div>
    </div>
  );
}

// ─── Reel chart ──────────────────────────────────────────────────────────────
function ReelChart({ progress, stamped, settled, agents }) {
  const path = TF.makePricePath(7, 300, 64200, 64650);
  const W = 1100, H = 360, padL = 60, padR = 20, padT = 24, padB = 36;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const visible = path.slice(0, Math.max(2, Math.floor(progress * path.length)));
  const minP = 64080, maxP = 64720;
  const xFor = (i, total) => padL + (i / Math.max(1, total - 1)) * innerW;
  const yFor = (p) => padT + (1 - (p - minP) / (maxP - minP)) * innerH;

  const lineD = visible.map((pt, i) => `${i === 0 ? 'M' : 'L'}${xFor(i, path.length).toFixed(1)} ${yFor(pt.price).toFixed(1)}`).join(' ');
  const areaD = visible.length > 1
    ? lineD + ` L${xFor(visible.length - 1, path.length).toFixed(1)} ${(padT + innerH).toFixed(1)} L${xFor(0, path.length).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`
    : '';
  const lastPx = visible[visible.length - 1]?.price ?? 64200;
  const lastX = xFor(visible.length - 1, path.length);
  const lastY = yFor(lastPx);

  return (
    <div className="tf-card" style={{ padding: '16px 22px', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
          <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--fg-dim)' }}>BTC/USD · 15m</span>
          <span className="tf-num" style={{ fontSize: 28, fontWeight: 600, color: settled ? 'var(--long)' : 'var(--fg)' }}>${lastPx.toFixed(0)}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: lastPx >= 64200 ? 'var(--long)' : 'var(--short)' }}>
            {lastPx >= 64200 ? '+' : ''}{(lastPx - 64200).toFixed(0)} ({(((lastPx - 64200) / 64200) * 100).toFixed(2)}%)
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cyan)', letterSpacing: '0.14em' }}>● PAPER · LIVE FEED</span>
      </div>
      <svg width={W - 44} height={H - 30} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="cf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(120, 220, 255, 0.32)" />
            <stop offset="100%" stopColor="rgba(120, 220, 255, 0)" />
          </linearGradient>
          <filter id="lg"><feGaussianBlur stdDeviation="2.5" /></filter>
        </defs>
        {[64100, 64300, 64500, 64700].map((p) => (
          <g key={p}>
            <line x1={padL} x2={W - padR} y1={yFor(p)} y2={yFor(p)} stroke="rgba(120,180,230,0.06)" strokeDasharray="2 4" />
            <text x={padL - 8} y={yFor(p) + 4} textAnchor="end" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg-faintest)">{p.toLocaleString()}</text>
          </g>
        ))}
        <line x1={padL} x2={W - padR} y1={yFor(64200)} y2={yFor(64200)} stroke="rgba(140,220,255,0.3)" strokeDasharray="3 3" />
        {settled && (
          <>
            <line x1={padL} x2={W - padR} y1={yFor(64650)} y2={yFor(64650)} stroke="rgba(70,220,140,0.6)" strokeDasharray="3 3" />
            <text x={W - padR - 6} y={yFor(64650) - 6} textAnchor="end" fontFamily="var(--font-mono)" fontSize="11" fill="var(--long)">SETTLE 64,650</text>
          </>
        )}
        {visible.length > 1 && <path d={areaD} fill="url(#cf)" />}
        {visible.length > 1 && <path d={lineD} fill="none" stroke="rgba(140,220,255,0.7)" strokeWidth="3.5" filter="url(#lg)" />}
        {visible.length > 1 && <path d={lineD} fill="none" stroke="#a8e8ff" strokeWidth="1.8" />}
        {visible.length > 1 && (
          <>
            <circle cx={lastX} cy={lastY} r="6" fill="#a8e8ff" />
            <circle cx={lastX} cy={lastY} r="14" fill="none" stroke="rgba(140,220,255,0.4)">
              <animate attributeName="r" from="6" to="20" dur="1.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.7" to="0" dur="1.4s" repeatCount="indefinite" />
            </circle>
          </>
        )}
        {/* Predictions stamped on chart */}
        {stamped && TF.AGENTS.map((a, i) => {
          const stampX = xFor(Math.floor(0.06 + i * 0.025) * 0 + 60 + i * 30, path.length);
          const x = padL + 70 + i * 35;
          const y = yFor(a.entryPrice);
          const isLong = a.prediction === 'LONG';
          const isShort = a.prediction === 'SHORT';
          const color = isLong ? 'var(--long)' : isShort ? 'var(--short)' : 'var(--hold)';
          return (
            <g key={a.id}>
              {(isLong || isShort) && (
                <polygon
                  points={isLong ? `${x},${y - 9} ${x - 6},${y + 5} ${x + 6},${y + 5}` : `${x},${y + 9} ${x - 6},${y - 5} ${x + 6},${y - 5}`}
                  fill={color}
                />
              )}
              {a.prediction === 'HOLD' && <rect x={x - 6} y={y - 6} width="12" height="12" fill="none" stroke={color} strokeWidth="2" />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Scene 4 · Consensus ─────────────────────────────────────────────────────
function SceneConsensus() {
  const { localTime } = useSprite();

  // Compute weights
  const weights = TF.AGENTS.reduce((acc, a) => {
    const m = TF.BRACKETS[a.bracket].mult;
    const w = a.confidence * m;
    if (a.prediction === 'LONG') acc.long += w;
    else if (a.prediction === 'SHORT') acc.short += w;
    else acc.hold += w;
    return acc;
  }, { long: 0, short: 0, hold: 0 });
  const total = weights.long + weights.short + weights.hold;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <FadeIn start={0} dur={0.5}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.22em', color: 'var(--cyan)', textTransform: 'uppercase', marginBottom: 30 }}>Weighted Consensus · Flock-powered</div>
      </FadeIn>

      {/* Six rays converging */}
      <div style={{ position: 'relative', width: 1200, height: 380 }}>
        <svg width="1200" height="380" style={{ position: 'absolute', inset: 0 }}>
          {TF.AGENTS.map((a, i) => {
            const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const r = 280;
            const x1 = 600 + Math.cos(angle) * r;
            const y1 = 190 + Math.sin(angle) * r;
            const t = Math.max(0, Math.min(1, (localTime - 0.5 - i * 0.1) / 1.5));
            const x = 600 + (x1 - 600) * (1 - t * 0.85);
            const y = 190 + (y1 - 190) * (1 - t * 0.85);
            const sp = TF.SPONSORS[a.sponsor];
            return (
              <g key={a.id}>
                <line x1={x1} y1={y1} x2={600} y2={190} stroke={sp.hue} strokeOpacity={0.18 + 0.4 * t} strokeWidth="1.5" strokeDasharray="3 5" />
                <circle cx={x} cy={y} r="6" fill={sp.hue} opacity={0.6 + 0.4 * t} />
                <circle cx={x} cy={y} r="14" fill="none" stroke={sp.hue} strokeOpacity={0.3 * t} />
              </g>
            );
          })}
        </svg>

        {/* Agent labels at perimeter */}
        {TF.AGENTS.map((a, i) => {
          const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const r = 320;
          const x = 600 + Math.cos(angle) * r;
          const y = 190 + Math.sin(angle) * r;
          const t = Math.max(0, Math.min(1, (localTime - 0.4 - i * 0.1) / 0.5));
          const sp = TF.SPONSORS[a.sponsor];
          return (
            <div key={a.id} style={{
              position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)',
              opacity: t,
              padding: '6px 10px', border: `1px solid ${sp.hue}`, borderRadius: 6,
              background: 'rgba(8, 16, 28, 0.7)',
              fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em',
              whiteSpace: 'nowrap',
            }}>
              <span style={{ color: sp.hue }}>{sp.mark}</span>
              <span style={{ color: 'var(--fg-dim)', marginLeft: 6 }}>{a.prediction}</span>
              <span style={{ color: 'var(--fg-faint)', marginLeft: 4 }}>×{TF.BRACKETS[a.bracket].mult}</span>
            </div>
          );
        })}

        {/* Center consensus orb */}
        <div style={{
          position: 'absolute', left: 600, top: 190, transform: 'translate(-50%, -50%)',
          width: 280, height: 280, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(140, 220, 255, 0.30), rgba(70, 220, 140, 0.10) 60%, transparent)',
          opacity: Math.max(0, Math.min(1, (localTime - 2.5) / 0.8)),
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.2em', color: 'var(--fg-faint)' }}>CONSENSUS</div>
          <div style={{ fontSize: 64, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--long)', marginTop: 4 }}>LONG</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--fg-dim)' }}>{Math.round((weights.long / total) * 100)}% confidence</div>
        </div>
      </div>

      {/* Weighted bar */}
      <FadeIn start={3.5} dur={0.6}>
        <div style={{ marginTop: 40, width: 900 }}>
          <div style={{ height: 14, borderRadius: 6, overflow: 'hidden', display: 'flex', background: 'rgba(255,255,255,0.04)' }}>
            <div style={{ width: `${(weights.long / total) * 100}%`, background: 'var(--long)' }} />
            <div style={{ width: `${(weights.hold / total) * 100}%`, background: 'var(--hold)', opacity: 0.7 }} />
            <div style={{ width: `${(weights.short / total) * 100}%`, background: 'var(--short)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 14 }}>
            <span style={{ color: 'var(--long)' }}>▲ LONG  weight {weights.long.toFixed(0)}</span>
            <span style={{ color: 'var(--hold)' }}>◼ HOLD  weight {weights.hold.toFixed(0)}</span>
            <span style={{ color: 'var(--short)' }}>▼ SHORT  weight {weights.short.toFixed(0)}</span>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}

// ─── Scene 5 · Settle ────────────────────────────────────────────────────────
function SceneSettle() {
  const { localTime, duration } = useSprite();
  const settleProgress = Math.max(0, Math.min(1, localTime / 8));
  const showResult = localTime > 7;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <FadeIn start={0} dur={0.4}>
        <div style={{ position: 'absolute', top: 130, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.22em', color: 'var(--cyan)', textTransform: 'uppercase' }}>15-MINUTE WINDOW · MARKET MOVES</div>
        </div>
      </FadeIn>

      <div style={{ position: 'absolute', top: 200, left: '50%', transform: 'translateX(-50%)', width: 1200, height: 460 }}>
        <ReelChart progress={settleProgress} stamped={true} settled={showResult} />
      </div>

      {/* Floating PnL chips for each agent */}
      {showResult && (
        <div style={{ position: 'absolute', top: 760, left: '50%', transform: 'translateX(-50%)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, width: 1300 }}>
          {TF.settle(TF.AGENTS, TF.END_PRICE).map((a, i) => {
            const t = Math.max(0, Math.min(1, (localTime - 7.2 - i * 0.18) / 0.5));
            const sp = TF.SPONSORS[a.sponsor];
            return (
              <div key={a.id} style={{
                opacity: t,
                transform: `translateY(${(1 - t) * 14}px) scale(${0.96 + 0.04 * t})`,
                padding: '12px 18px', borderRadius: 10,
                border: `1px solid ${a.roundPnl >= 0 ? 'var(--long)' : 'var(--short)'}`,
                background: a.roundPnl >= 0 ? 'var(--long-bg)' : 'var(--short-bg)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: sp.hue, letterSpacing: '0.12em' }}>{sp.mark}</span>
                  <span style={{ fontSize: 14, color: 'var(--fg-dim)' }}>{a.name}</span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, color: a.roundPnl >= 0 ? 'var(--long)' : 'var(--short)' }}>
                  {a.roundPnl >= 0 ? '+' : ''}${a.roundPnl.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Scene 6 · Leaderboard ───────────────────────────────────────────────────
function SceneLeaderboard() {
  const { localTime } = useSprite();
  const settled = TF.settle(TF.AGENTS, TF.END_PRICE);
  const ranked = [...settled].sort((a, b) => b.totalPnlAfter - a.totalPnlAfter);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <FadeIn start={0} dur={0.5}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.22em', color: 'var(--cyan)', textTransform: 'uppercase', marginBottom: 30 }}>Reputation reshuffles · PnL is the rank</div>
      </FadeIn>

      <div style={{ width: 1100 }}>
        <div className="tf-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-faint)', letterSpacing: '0.18em' }}>
            <span>LIVE PnL LEADERBOARD</span>
            <span>RANK · DELTA · TOTAL · BRACKET</span>
          </div>
          {ranked.map((a, i) => {
            const t = Math.max(0, Math.min(1, (localTime - 0.6 - i * 0.25) / 0.6));
            const sp = TF.SPONSORS[a.sponsor];
            const br = TF.BRACKETS[a.bracket];
            return (
              <div key={a.id} style={{
                opacity: t,
                transform: `translateY(${(1 - t) * 18}px)`,
                display: 'grid', gridTemplateColumns: '50px 90px 1fr 130px 140px 140px',
                alignItems: 'center', gap: 18,
                padding: '14px 18px', borderRadius: 10, marginBottom: 8,
                background: i === 0 ? 'rgba(140,220,255,0.06)' : 'rgba(20, 36, 60, 0.3)',
                border: i === 0 ? '1px solid rgba(140,220,255,0.3)' : '1px solid var(--line)',
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, color: i === 0 ? 'var(--cyan)' : 'var(--fg-faint)' }}>#{i + 1}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: sp.hue, letterSpacing: '0.14em' }}>{sp.mark}</span>
                <span style={{ fontSize: 16 }}>{a.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: a.roundPnl >= 0 ? 'var(--long)' : 'var(--short)' }}>{a.roundPnl >= 0 ? '+' : ''}${a.roundPnl.toFixed(2)}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 600, color: a.totalPnlAfter >= 0 ? 'var(--fg)' : 'var(--short)' }}>{a.totalPnlAfter >= 0 ? '+' : ''}${a.totalPnlAfter.toFixed(2)}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: br.color, padding: '4px 10px', border: '1px solid currentColor', borderRadius: 4, justifySelf: 'end' }}>{br.glyph} {br.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Scene 7 · Fees ──────────────────────────────────────────────────────────
function SceneFees() {
  const { localTime } = useSprite();
  const settled = TF.settle(TF.AGENTS, TF.END_PRICE);
  const rewards = TF.distribute(settled, TF.AGENT_REWARD_POOL);
  const winners = rewards.filter(a => a.rewardUsdc > 0).sort((a, b) => b.rewardUsdc - a.rewardUsdc);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <FadeIn start={0} dur={0.5}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.22em', color: 'var(--cyan)', textTransform: 'uppercase', marginBottom: 24 }}>Fee distribution · Base USDC settlement</div>
      </FadeIn>

      <FadeIn start={0.3} dur={0.5}>
        <div style={{
          padding: '16px 32px', border: '1px solid var(--line-bright)', borderRadius: 12,
          background: 'rgba(140, 220, 255, 0.06)',
          fontFamily: 'var(--font-mono)', fontSize: 22, color: 'var(--cyan)', letterSpacing: '-0.01em',
          marginBottom: 32,
        }}>
          ROUND FEE POOL · <span style={{ fontWeight: 600 }}>10.00 USDC</span>
        </div>
      </FadeIn>

      <div style={{ width: 1100, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {winners.map((a, i) => {
          const t = Math.max(0, Math.min(1, (localTime - 1.0 - i * 0.5) / 0.7));
          const sp = TF.SPONSORS[a.sponsor];
          return (
            <div key={a.id} style={{
              opacity: t,
              transform: `translateX(${(1 - t) * -30}px)`,
              display: 'grid', gridTemplateColumns: '120px 1fr 100px 200px',
              alignItems: 'center', gap: 24,
              padding: '18px 28px', borderRadius: 12,
              background: 'rgba(20, 36, 60, 0.5)',
              border: '1px solid rgba(140, 220, 255, 0.25)',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: sp.hue, letterSpacing: '0.14em' }}>{sp.mark}</span>
              <span style={{ fontSize: 20, fontWeight: 500 }}>{a.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--fg-faint)' }}>{a.rewardShare.toFixed(0)}%</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 600, color: 'var(--cyan)', textAlign: 'right' }}>
                {a.rewardUsdc.toFixed(2)} USDC
              </span>
            </div>
          );
        })}
      </div>

      <FadeIn start={6} dur={0.5}>
        <div style={{ marginTop: 32, fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--fg-faint)', letterSpacing: '0.1em' }}>
          ONLY POSITIVE-PnL AGENTS EARN · LOSING AGENTS PAY THE OPPORTUNITY COST
        </div>
      </FadeIn>
    </div>
  );
}

// ─── Scene 8 · Finale (6 → 60 → 600 → 60,000) ────────────────────────────────
function SceneFinale() {
  const { localTime } = useSprite();
  const counts = [
    { v: 6,     l: 'TODAY · HACKATHON',   t: 0 },
    { v: 60,    l: 'WEEK 1 · LAUNCH',     t: 1.5 },
    { v: 600,   l: 'MONTH 1 · GROWTH',    t: 4 },
    { v: 6000,  l: 'YEAR 1 · NETWORK',    t: 7 },
    { v: 60000, l: 'AT SCALE · COLLECTIVE', t: 10 },
  ];
  const showHero = localTime > 13;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {/* Top eyebrow */}
      <FadeIn start={0} dur={0.5}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.24em', color: 'var(--cyan)', textTransform: 'uppercase', marginBottom: 20 }}>What if it wasn't 6 agents…</div>
      </FadeIn>

      {/* The big number */}
      {!showHero && (() => {
        const current = counts.filter(c => localTime >= c.t).pop() || counts[0];
        const t = Math.max(0, Math.min(1, (localTime - current.t) / 0.6));
        return (
          <div key={current.v} style={{ textAlign: 'center', opacity: t }}>
            <div style={{ fontSize: 240, fontWeight: 600, letterSpacing: '-0.05em', lineHeight: 1, color: 'var(--cyan)', textShadow: '0 0 80px rgba(140,220,255,0.4)' }} className="tf-num">
              {current.v.toLocaleString()}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, letterSpacing: '0.2em', color: 'var(--fg-dim)', marginTop: 12 }}>
              {current.l} · AGENTS
            </div>
          </div>
        );
      })()}

      {/* Hero closer */}
      {showHero && (
        <div style={{ textAlign: 'center', maxWidth: 1500 }}>
          <FadeIn start={0} dur={0.6}>
            <div style={{ fontSize: 96, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1.0 }}>
              Trading agents,<br/>
              <span style={{ color: 'var(--cyan)' }}>with consequences.</span>
            </div>
          </FadeIn>
          <FadeIn start={0.6} dur={0.6}>
            <div style={{ marginTop: 40, fontSize: 22, color: 'var(--fg-dim)', maxWidth: 900, margin: '40px auto 0' }}>
              TradeFish · A Base-native arena where every answer is a paper trade and PnL is the only voice.
            </div>
          </FadeIn>
          <FadeIn start={1.2} dur={0.5}>
            <div style={{ marginTop: 48, display: 'flex', gap: 28, justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.18em', color: 'var(--fg-faint)' }}>
              <span style={{ color: 'var(--s-flock)' }}>FLOCK</span>
              <span style={{ color: 'var(--s-nansen)' }}>NANSEN</span>
              <span style={{ color: 'var(--s-virtuals)' }}>VIRTUALS</span>
              <span style={{ color: 'var(--s-pancake)' }}>PCS</span>
              <span style={{ color: 'var(--s-bananagun)' }}>BNGUN</span>
              <span style={{ color: 'var(--s-base)' }}>BASE</span>
            </div>
          </FadeIn>
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  SwarmLayer,
  SceneProblem, SceneQuestion, SceneAgents,
  SceneConsensus, SceneSettle, SceneLeaderboard,
  SceneFees, SceneFinale,
});
