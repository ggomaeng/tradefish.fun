"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Hero swarm v6 — neon-phosphor wedge that gazes at the cursor. ~1200
 * desktop / ~520 mobile pixel-fish in an inverted-triangle (▽) formation
 * filling a substantial portion of the canvas. Brand palette is logo-matched
 * neon (magenta / violet / indigo / cyan / mint).
 *
 *  1. **Inverted-triangle wedge formation** — wide at the top, narrowing
 *     toward a small apex at the bottom. Dramatic silhouette that reads
 *     deliberately even at a glance.
 *
 *  2. **Curl-flow ocean current** drives X/Y velocity (2D simplex noise
 *     sampled at time-shifted coordinates), producing organic swirling
 *     motion without per-pair flocking math.
 *
 *  3. **Homing spring + speed cap** keeps the wedge silhouette readable —
 *     each particle is pulled back toward its assigned formation slot and
 *     can't exceed a velocity ceiling.
 *
 *  4. **Cursor soft pull + gaze override** — the marquee interaction. When
 *     the cursor is on the canvas, every fish ROTATES to face it (overriding
 *     velocity heading) and the whole wedge leans toward it with a gentle
 *     attraction force. Reads as "the swarm is watching you."
 *
 *  5. **Velocity-aligned glyphs (when idle)** — when the cursor is away,
 *     each pixel-fish rotates to face its instantaneous velocity so the
 *     school visibly swims.
 *
 *  6. **Two-pass render** — main pass (hard-pixel rectangles, NormalBlending)
 *     plus a halo pass (larger gl_PointSize, soft circular alpha, additive)
 *     sharing geometry. Bioluminescent glow behind hard pixels.
 *
 *  7. **Depth fog** in the vertex shader pulls far particles toward the
 *     background colour, giving the staging an underwater read.
 *
 *  8. **Stochastic directional waves** — random angle, strength, cadence.
 *     No phase coupling, no consensus cycle — the swarm reads as
 *     continuously alive without any perceivable "loop."
 *
 * Color path is uniform-driven: each particle holds an integer palette index
 * (aPaletteIdx) and a per-frame quantized brightness (aBrightness, 4 discrete
 * steps). The fragment shader writes hard rectangles — no smoothstep, no AA
 * — so the pixel identity from the X banner stays intact.
 *
 * Honors prefers-reduced-motion (renders one static frame at t=0).
 * StrictMode-safe: cleans up renderer / geometry / RAF / ResizeObserver /
 * pointer listeners / halo material.
 */

const TAU = Math.PI * 2;
const GOLDEN = 2.39996322972865332;

// DEFAULT (calm) palette — iridescent deep-sea school with silhouette
// shadow-side. ~30% of fish are deep navy that reads as DARK SILHOUETTES
// against the central bloom (matches real bait-ball footage where half
// the school is in shadow). The brighter cyan/mint/pearl tones carry
// the iridescent light-catching side. Solana neon takes over on burst.
const PALETTE_HEX = [
  0xeaf4f9, // silver-pearl highlight (rare, sells iridescence)
  0x9adae8, // pale cyan
  0x2dd4ff, // vivid cyan (focal — carries narrative weight)
  0x7fe0a8, // mint
  0x0e1a28, // deep navy silhouette (shadow side — reads dark vs bloom)
] as const;
// Distribution: pearl rare (10%), silhouettes substantial (30%) so the
// school has clear value range, cyan + mint fill the middle.
const PALETTE_CUMULATIVE = [0.1, 0.35, 0.55, 0.7, 1.0] as const;

// Solana-brand palette — fired during the submit burst when the user
// commits a question. Purple (#9945FF) → magenta bridge (#DC1FFF) →
// green (#14F195). The vertex shader linearly mixes PALETTE_HEX with
// this one by `uPaletteMix` (0 = calm, 1 = full Solana neon).
const SOLANA_HEX = [
  0x9945ff, // Solana purple
  0xb566ff, // purple → pink bridge
  0xdc1fff, // hot magenta
  0x14f195, // Solana green
  0x58f7b0, // mint-green highlight
] as const;

// Directional sweep waves — pure stochastic (no phase coupling, no cycle).
const MAX_WAVES = 2;
const WAVE_DURATION = 5.5;
const WAVE_INTERVAL_MIN = 1.1;
const WAVE_INTERVAL_MAX = 3.4;

// ── Boids tuning constants ──────────────────────────────────────────
// Calibrated for visible cluster formation + dramatic predator response.
// Earlier values (1200 fish, COH_R 75, W_COH 0.10) produced a uniform
// "bacterial colony" look because density was too high and cohesion
// radius was so broad each fish averaged out to no preferred direction.
// Reduced count + tighter neighbor radii + stronger cohesion/alignment
// = real emergent groups. Stronger predator = visible escape void.
// School packing with UNIFORM spacing — fish cluster but maintain personal
// space. Bumped SEP_R 5 → 11 so separation force acts before fish actually
// touch, producing visibly even gaps within each cluster.
const SEP_R = 11;
const ALI_R = 20;
const COH_R = 28;
const PRED_R = 140; // detection radius — fish notice cursor + start fleeing
const MAX_SPEED = 22;
const PANIC_SPEED = 38; // when within PANIC_R, fish exceed MAX_SPEED escaping
const PANIC_R = 75; // inside this radius, velocity is INJECTED toward escape
const PANIC_BLEND = 0.55; // 55% of velocity replaced toward escape per frame
// Cohesion bumped so the school travels as one body. Alignment kept just
// loose enough that sub-groups can vary heading slightly — sells "organic
// school with internal sub-currents" over "lockstep parade".
const W_SEP = 0.4;
const W_ALI = 0.2;
const W_COH = 0.22;
// CRITICAL: W_BND raised from 0.015 → 0.18 to actually contain fish.
// At 0.015 the bounds force was max ~0.8 units/sec² — fish at MAX_SPEED
// needed >200 units to decelerate, far beyond our 30-unit buffer, so
// the swarm broke out of canvas and "disappeared." 0.18 gives ~10 sec²
// max decel — fish stop within the buffer cleanly.
const W_BND = 0.18;
// Wander reduced further (0.025 → 0.018) so Brownian jitter doesn't fight
// the stronger cohesion. School moves deliberately, in unison.
const W_RAND = 0.018;
// W_PRED softened from 0.65 → 0.40 — strong enough for visible escape
// void but no longer flings fish through the bounds wall.
const W_PRED = 0.4;
// Visible canvas bounds (approx from camera z=380, fov 45°). Kept for the
// spatial hash + initial seed scatter. The actual fish-containment force
// now uses ELLIPTICAL bounds (BOUND_A / BOUND_B) recentered each frame on
// the current orbit center so the school always lives in the viewport.
const BOUND_X = 310;
const BOUND_Y = 160;
// Buffer doubled 30 → 60 for more deceleration runway against MAX_SPEED.
const BOUND_BUFFER = 60;
// Elliptical-bounds semi-axes. Tightened in a second pass so the school
// clusters near viewport center instead of smearing all the way to the
// corners — reads more as a cohesive shoal, less as ambient dust.
const BOUND_A = 215;
const BOUND_B = 170;
// Soft-shell radius (squared, normalised) — inside this, no bounds force.
// Crossing it ramps push linearly to 1 at the ellipse edge.
const BOUND_SHELL_SQ = 0.78;
// Spatial hash cell size — matches COH_R. With 2500 fish + cellSize 28,
// avg ~9 fish per cell × 9-cell query = ~80 per fish; total ~200k
// comparisons/frame ≈ 10 ms (within 16 ms budget).
const CELL_SIZE = 28;
const SEP_R_SQ = SEP_R * SEP_R;
const ALI_R_SQ = ALI_R * ALI_R;
const COH_R_SQ = COH_R * COH_R;
const PRED_R_SQ = PRED_R * PRED_R;
const PANIC_R_SQ = PANIC_R * PANIC_R;

// ── Attention mode (input focus) tuning ─────────────────────────────
// When the user focuses the landing input the swarm flips from
// "predator flee" to "vortex around the input center" — a radial-
// spring + tangential-bias steering force computed per fish.
// V_ORBIT_FOCUS sits just below MAX_SPEED so Boids forces still nudge.
// _BURST values are reached during the ~600ms submit collapse.
// Two orbit-radius tiers. The LOOSE radius is the default state — fish
// continuously circulate as a cohesive blob around the viewport center
// (the radial spring is weak at loose, so they swirl around R instead of
// snapping to a strict ring). FOCUS tightens with full radial spring.
// At fov 45°, z=380, world half-height ≈ 157 → keep both inside bounds.
const R_LOOSE_DESKTOP = 110;
const R_LOOSE_MOBILE = 80;
const R_FOCUS_DESKTOP = 130;
const R_FOCUS_MOBILE = 95;
const R_TARGET_BURST = 50;
// Radial spring strength: stronger pull at loose (14) so the band edges
// hold cleanly and fish snap into the vortex shape on load. FULL strength
// at focus tightens further onto a denser ring.
const V_RADIAL_GAIN_LOOSE = 14;
// Faster orbit so the swirl is obvious within 1s of focus. Was 18 — at
// r=140 that gave ~7s/lap, way too lazy to read as a vortex. 28 ≈ ~3s/lap.
const V_ORBIT_FOCUS = 28;
const V_ORBIT_BURST = 8;
const V_RADIAL_GAIN = 22;
// Snappier convergence — fish settle onto the ring in <600ms.
const K_STEER = 4.0;
// Fish render-size multiplier while attention is engaged. Bigger
// baseline (~80% bigger per fish vs v1) means this multiplier can be
// gentler — just enough to make the orbit visibly "lean in" without
// blowing the school out of proportion.
const SIZE_MULT_FOCUS = 1.3;
const SIZE_MULT_BURST = 1.7;
// Per-frame lerp factors at 60fps: ATTENTION_LERP_IN ≈ 500ms ramp-up,
// ATTENTION_LERP_OUT ≈ 800ms ramp-down. Multiplied by dt*60 in the
// loop so the effective time is frame-rate-independent.
const ATTENTION_LERP_IN = 0.045;
const ATTENTION_LERP_OUT = 0.025;
// Submit burst envelope (seconds): rise → hold → decay.
const BURST_RISE = 0.1;
const BURST_HOLD = 0.05;
const BURST_DECAY = 0.45;
const BURST_TOTAL = BURST_RISE + BURST_HOLD + BURST_DECAY;

interface SignalWave {
  active: boolean;
  // Unit direction the wavefront travels through the school.
  dirX: number;
  dirY: number;
  dirZ: number;
  // Wavefront's projected position at t=startTime (just behind the school).
  startProj: number;
  // Total projected distance the wave needs to traverse.
  spanProj: number;
  startTime: number;
  // Loudness 0..1. Diverge-phase waves vary (uncertain agents speak softer);
  // consensus-phase broadcast is always 1.0.
  strength: number;
}

/**
 * Mulberry32-style integer hash → [0, 1). Deterministic, allocation-free.
 * Used to seed per-particle breath frequencies, phases, and hues.
 */
function hash01(x: number): number {
  let z = x | 0;
  z = (z ^ 0x6d2b79f5) | 0;
  z = Math.imul(z ^ (z >>> 15), z | 1);
  z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
  return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
}

/**
 * Simple uniform-grid spatial hash for O(N·k) Boids neighbor queries.
 *
 * Each cell stores fish indices in a preallocated bucket (Int32Array) with
 * a `counts` array tracking how many indices are currently in each cell.
 * `clear()` resets counts (zero-cost, doesn't dirty the buckets). `insert`
 * appends an index. `forEachNeighborCell(px, py, cb)` invokes `cb(cellIdx)`
 * for the 9 cells in a 3×3 neighborhood around `(px, py)`.
 *
 * Bucket capacity is pre-sized for our worst-case density (cells in a
 * tight cohesion cluster). Overflow is silently dropped — acceptable since
 * a missed neighbor on one frame self-corrects within a few frames as the
 * cluster relaxes.
 */
class SpatialHash {
  readonly cellsX: number;
  readonly cellsY: number;
  readonly bucketSize: number;
  readonly counts: Int32Array;
  readonly buckets: Int32Array;
  constructor(
    private readonly boundX: number,
    private readonly boundY: number,
    private readonly cellSize: number,
    bucketSize: number,
  ) {
    this.cellsX = Math.ceil((boundX * 2 + cellSize) / cellSize);
    this.cellsY = Math.ceil((boundY * 2 + cellSize) / cellSize);
    this.bucketSize = bucketSize;
    this.counts = new Int32Array(this.cellsX * this.cellsY);
    this.buckets = new Int32Array(this.cellsX * this.cellsY * bucketSize);
  }
  clear(): void {
    this.counts.fill(0);
  }
  cellIndex(px: number, py: number): number {
    const cx = Math.min(
      this.cellsX - 1,
      Math.max(0, Math.floor((px + this.boundX) / this.cellSize)),
    );
    const cy = Math.min(
      this.cellsY - 1,
      Math.max(0, Math.floor((py + this.boundY) / this.cellSize)),
    );
    return cy * this.cellsX + cx;
  }
  insert(idx: number, px: number, py: number): void {
    const cell = this.cellIndex(px, py);
    const count = this.counts[cell];
    if (count < this.bucketSize) {
      this.buckets[cell * this.bucketSize + count] = idx;
      this.counts[cell] = count + 1;
    }
    // overflow: silently drop (self-corrects within a frame or two)
  }
  /** Returns the start offset in `buckets` for cell `cellIdx`. */
  bucketStart(cellIdx: number): number {
    return cellIdx * this.bucketSize;
  }
}

/**
 * Per-particle palette index ∈ {0,1,2,3,4}. Deterministic from particle
 * index. The cumulative-distribution check picks magenta/violet/indigo/
 * cyan/mint with the bias defined in PALETTE_CUMULATIVE — cyan + mint
 * dominate so the screen reads phosphor-y, magenta + violet are accent
 * sparks (matches the X banner palette).
 */
function buildPaletteIndices(out: Float32Array, n: number): void {
  for (let i = 0; i < n; i++) {
    const r = hash01(i * 104729 + 11);
    if (r < PALETTE_CUMULATIVE[0]) out[i] = 0;
    else if (r < PALETTE_CUMULATIVE[1]) out[i] = 1;
    else if (r < PALETTE_CUMULATIVE[2]) out[i] = 2;
    else if (r < PALETTE_CUMULATIVE[3]) out[i] = 3;
    else out[i] = 4;
  }
}

/**
 * Build the uPalette uniform value as a flat array of THREE.Vector3 (Three.js
 * passes vec3 array uniforms as {x,y,z} per element). Linear-RGB; no
 * gamma correction — the additive-free fragment shader writes vColor
 * directly to gl_FragColor.
 */
function buildPaletteUniform(hexes: readonly number[]): THREE.Vector3[] {
  return hexes.map((hex) => {
    const r = ((hex >> 16) & 0xff) / 255;
    const g = ((hex >> 8) & 0xff) / 255;
    const b = (hex & 0xff) / 255;
    return new THREE.Vector3(r, g, b);
  });
}

export function HeroSwarm() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // Particle count — reduced from 2800/1250 (dense bait ball) to
    // 1100/480 (sparser school). Combined with the larger per-fish
    // baseSize below, individual fish read as recognisable creatures
    // rather than dust, which matches the design direction of a clearer
    // orbital silhouette at the expense of "infinite swarm" density.
    const count = isMobile ? 500 : 1100;
    // Wave: directional plane sweep across the school for random brightness
    // bursts on top of Boids motion. Wave projection uses world position.
    const waveWidth = isMobile ? 36 : 56;

    const initialRect = container.getBoundingClientRect();
    const canvasW = Math.max(1, initialRect.width);
    const canvasH = Math.max(1, initialRect.height);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, canvasW / canvasH, 1, 2000);
    camera.position.set(0, 0, 380);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvasW, canvasH);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = "hero-canvas";
    container.appendChild(renderer.domElement);

    // Per-particle precomputed buffers — allocated once, mutated each frame.
    // Color comes from a 5-stop palette LUT in the shader (uPalette) indexed
    // per-particle by aPaletteIdx, modulated by aBrightness (quantized to 4
    // steps each frame for the phosphor-step look). `aHeading` rotates each
    // pixel-fish to face its velocity direction (atan2(vy, vx) per frame).
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 2); // 2D: vx, vy. Z is anchored.
    const intensities = new Float32Array(count);
    const sizes = new Float32Array(count);
    const paletteIndices = new Float32Array(count);
    const brightnesses = new Float32Array(count);
    const headings = new Float32Array(count);
    const swimPhases = new Float32Array(count);
    // Per-fish focus-stagger phase ∈ [0, 1]. The shader treats this as
    // each fish's "activation threshold" along the global uFocusDrive
    // ramp — fish with low phase light up to Solana neon first when the
    // input focuses, high-phase fish trail behind. Deterministic from
    // particle index so the cascade pattern is stable across reloads.
    const focusPhases = new Float32Array(count);
    buildPaletteIndices(paletteIndices, count);
    // Per-fish swim wiggle phase desync — some bend left, some right.
    for (let i = 0; i < count; i++) {
      swimPhases[i] = hash01(i * 39769 + 7) * TAU;
      focusPhases[i] = hash01(i * 24917 + 41);
    }
    sizes.fill(1.0); // Main school: uniform baseline size; pulse via aIntensity.

    // ── Boids initial state ─────────────────────────────────────────
    // VORTEX-SEEDED: fish start in a wide ring BAND at evenly-spaced
    // angles, all moving tangentially CCW. Per-fish HETEROGENEITY: each
    // fish gets a stable preferred radius offset, orbital speed multi,
    // and heading jitter so the school has natural variation instead of
    // a perfectly synchronized ring.
    const initialRingR = isMobile ? R_LOOSE_MOBILE : R_LOOSE_DESKTOP;
    const ringBand = 35;
    const zSpeeds = new Float32Array(count);
    // Per-fish preferred radius offset (±25 around the nominal R_LOOSE).
    const radiusOffsets = new Float32Array(count);
    // Per-fish orbital speed multiplier (0.75..1.25 → ±25% variation).
    const speedMults = new Float32Array(count);
    // Per-fish heading jitter for less synchronized facing direction.
    const headingJitter = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const ringAngle = (i / count) * TAU + hash01(i * 1811 + 53) * 0.12;
      // Per-fish preferred radius offset (stable across the whole run).
      // Triangular distribution biased toward the nominal radius.
      radiusOffsets[i] =
        (hash01(i * 1811 + 17) + hash01(i * 1811 + 31) - 1) * ringBand;
      // Per-fish orbital speed multiplier — natural overtaking.
      speedMults[i] = 0.75 + hash01(i * 1811 + 89) * 0.5; // [0.75, 1.25]
      // Per-fish heading jitter — fish aren't all perfectly tangent.
      headingJitter[i] = (hash01(i * 1811 + 103) * 2 - 1) * 0.1;

      const r = initialRingR + radiusOffsets[i];
      positions[i3] = r * Math.cos(ringAngle);
      positions[i3 + 1] = r * Math.sin(ringAngle);
      // Wide z range (±100) for layered depth so front fish render large +
      // bright, back fish tiny + faded — gives the real 3D sardine feel.
      positions[i3 + 2] = (hash01(i * 1811 + 29) * 2 - 1) * 100;
      zSpeeds[i] = (hash01(i * 1811 + 71) * 2 - 1) * 5; // ±5 units/sec z-drift
      // Tangent velocity (CCW) matches the orbital force direction → no
      // jolt on first frame.
      const tangent = ringAngle + Math.PI / 2 + headingJitter[i];
      const speed = MAX_SPEED * (0.5 + hash01(i * 1811 + 67) * 0.2);
      velocities[i * 2] = Math.cos(tangent) * speed;
      velocities[i * 2 + 1] = Math.sin(tangent) * speed;
      headings[i] = tangent;
    }

    // Spatial hash for O(N·k) neighbor lookup in the Boids force loop.
    // Bucket size sized for worst-case density (a tight cohesion cluster).
    const spatialHash = new SpatialHash(BOUND_X, BOUND_Y, CELL_SIZE, 96);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute(
      "aIntensity",
      new THREE.BufferAttribute(intensities, 1),
    );
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute(
      "aPaletteIdx",
      new THREE.BufferAttribute(paletteIndices, 1),
    );
    geometry.setAttribute(
      "aBrightness",
      new THREE.BufferAttribute(brightnesses, 1),
    );
    geometry.setAttribute("aHeading", new THREE.BufferAttribute(headings, 1));
    geometry.setAttribute(
      "aSwimPhase",
      new THREE.BufferAttribute(swimPhases, 1),
    );
    geometry.setAttribute(
      "aFocusPhase",
      new THREE.BufferAttribute(focusPhases, 1),
    );

    // Custom shader for the pixel-CRT retrofit: each particle is a hard-edged
    // pixel rectangle drawn in one of 5 phosphor colors selected from a
    // uniform palette LUT. The main school renders as HORIZONTAL PIXEL-FISH
    // bars (uAspect.x = 1.0 = full width, uAspect.y ≈ 0.42 = squat height)
    // — each one reads as a tiny side-view fish swimming along the school's
    // +X axis. Ambient particles use square aspect (1.0, 1.0) so they read
    // as background dust, distinct from the focal school. Brightness is
    // quantized per-frame to 4 discrete steps for the CRT phosphor-step
    // look. NormalBlending replaces additive so overlapping particles
    // never saturate to white.
    // Larger sprites pair with the lower particle count for a "fewer,
    // bigger fish" read. Each pixel-fish is now ~80% bigger than v1 so
    // the body shape + swim wiggle are visible at a glance.
    const baseSize = isMobile ? 11.0 : 16.5;
    const pulseSize = isMobile ? 4.2 : 6.0;
    const sizeUniform = { value: new THREE.Vector2(baseSize, pulseSize) };
    const scaleUniform = {
      value: renderer.domElement.height / 2,
    };
    const paletteUniform = { value: buildPaletteUniform(PALETTE_HEX) };
    // Solana-neon alternate palette — interpolated against `paletteUniform`
    // by `paletteMixUniform`. Both share the same 5-stop indexing scheme,
    // so a fish keeps its "species" (its aPaletteIdx) across the mix.
    const paletteAltUniform = { value: buildPaletteUniform(SOLANA_HEX) };
    const paletteMixUniform = { value: 0 };
    // Focus-stagger uniform. `uFocusDrive` is the global ramp value
    // (0 → 0.65 over the focus lerp window). Each fish's cascade gate
    // opens when the drive crosses its `aFocusPhase * 0.5` threshold —
    // low-phase fish first, high-phase fish last (random scatter).
    // Once gated open, the shader applies a per-fish sinusoidal flicker
    // (uTime + aFocusPhase * 2π) so each fish oscillates between
    // mostly-default and full-Solana with its own phase offset — the
    // school is constantly alternating Solana on/off while focused.
    // Submit-burst still drives `uPaletteMix` directly; shader max()s.
    const focusDriveUniform = { value: 0 };
    // Global brightness multiplier. Pumped during the submit burst so the
    // entire school visibly flares as the page hands off to /round/[id].
    const burstBrightUniform = { value: 1.0 };
    // Per-fish size multiplier. Default 1.0; ramped up by aEff during
    // attention mode so the orbit pattern is obvious at a glance.
    const sizeMultUniform = { value: 1.0 };
    // Main school: SLIMMER horizontal egg-shape (uAspect.y 0.38 → 0.28)
    // — fish look like long sardines rather than chunky pills.
    const aspectMain = { value: new THREE.Vector2(1.0, 0.28) };
    // uTime drives the per-fish 2-joint swim animation in the fragment
    // shader (sinusoidal S-curve body bend).
    const timeUniform = { value: 0 };
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uSize: sizeUniform,
        uScale: scaleUniform,
        uPalette: paletteUniform,
        uPaletteAlt: paletteAltUniform,
        uPaletteMix: paletteMixUniform,
        uFocusDrive: focusDriveUniform,
        uBurstBright: burstBrightUniform,
        uSizeMult: sizeMultUniform,
        uAspect: aspectMain,
        uTime: timeUniform,
      },
      vertexShader: `
        attribute float aIntensity;
        attribute float aSize;
        attribute float aPaletteIdx;
        attribute float aBrightness;
        attribute float aHeading;
        attribute float aSwimPhase;
        attribute float aFocusPhase;
        uniform vec2 uSize;
        uniform float uScale;
        uniform vec3 uPalette[5];
        uniform vec3 uPaletteAlt[5];
        uniform float uPaletteMix;
        uniform float uFocusDrive;
        uniform float uBurstBright;
        uniform float uSizeMult;
        uniform float uTime;
        varying vec3 vColor;
        varying float vHeading;
        varying float vSwimPhase;
        void main() {
          // Branch-pick BOTH palette colours by integer index, then mix.
          // Bulletproof on every WebGL1 driver vs dynamic uniform-array
          // indexing. Mixing at the source keeps the per-fish "species"
          // identity (aPaletteIdx) consistent across the cyan→Solana swap.
          int idx = int(aPaletteIdx);
          vec3 baseA;
          vec3 baseB;
          if (idx == 0) { baseA = uPalette[0]; baseB = uPaletteAlt[0]; }
          else if (idx == 1) { baseA = uPalette[1]; baseB = uPaletteAlt[1]; }
          else if (idx == 2) { baseA = uPalette[2]; baseB = uPaletteAlt[2]; }
          else if (idx == 3) { baseA = uPalette[3]; baseB = uPaletteAlt[3]; }
          else { baseA = uPalette[4]; baseB = uPaletteAlt[4]; }
          // Per-fish focus contribution.
          //   cascadeGate: smoothstep gates each fish at its own
          //     threshold (aFocusPhase*0.5 .. +0.15). Drive ramps 0→0.65
          //     so even latest fish (phase=1.0, threshold up to 0.65)
          //     fully gates open at drive peak.
          //   flicker: each fish oscillates 0..1 at ~2s period, phase-
          //     offset by its own aFocusPhase * 2π so neighbours are at
          //     different points in the cycle. Result is a constantly-
          //     shimmering school — at any moment some fish are at peak
          //     Solana, others at near-default cyan.
          //   heldMix: linear remap to [0.5, 0.95]. Dip is STILL half-
          //     Solana (not back to cyan default) so the school keeps
          //     its Solana identity throughout the flicker — peak is
          //     full neon. Earlier 0.15 dip washed the Solana feel out.
          //   focusLocalMix = cascadeGate * heldMix: cascade ramps the
          //     amplitude in/out; flicker rides on top.
          // Submit burst still drives uPaletteMix to 1.0 directly; the
          // max() below makes burst dominate when active.
          float cascadeGate = smoothstep(
            aFocusPhase * 0.5,
            aFocusPhase * 0.5 + 0.15,
            uFocusDrive
          );
          float flickerPhase = uTime * 3.1 + aFocusPhase * 6.28318;
          float flicker = 0.5 - 0.5 * cos(flickerPhase);
          float heldMix = mix(0.5, 0.95, flicker);
          float focusLocalMix = cascadeGate * heldMix;
          float mixAmount = max(focusLocalMix, uPaletteMix);
          vec3 base = mix(baseA, baseB, mixAmount);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          // Depth fog in CAMERA space. With z spread ±110, mvPos.z ranges
          // ~-270 (closest, big + bright) to ~-490 (farthest, small + dim).
          // Combined with perspective gl_PointSize scaling, this gives the
          // dramatic layered depth of a real sardine school.
          float depthFog = mix(0.35, 1.0, smoothstep(-490.0, -270.0, mvPos.z));
          vColor = base * aBrightness * depthFog * uBurstBright;
          vHeading = aHeading;
          vSwimPhase = aSwimPhase;
          float size = (uSize.x * aSize + aIntensity * uSize.y) * uSizeMult;
          gl_PointSize = size * (uScale / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vHeading;
        varying float vSwimPhase;
        uniform vec2 uAspect;
        uniform float uTime;
        void main() {
          // Rotation to body-local coords (gl_PointCoord.y is flipped vs
          // world Y, so the sin term is negated).
          vec2 uv = (gl_PointCoord - vec2(0.5)) * 2.0;
          float c = cos(vHeading);
          float s = sin(vHeading);
          vec2 r = vec2(uv.x * c - uv.y * s, -uv.x * s - uv.y * c);

          // ── 2-joint swimming animation ─────────────────────────
          // The body bends along a sin wave that TRAVELS from head to tail
          // over time — like a real fish's propulsion wave. Two visible
          // peaks (head + body joint, body + tail joint) because the
          // wavelength matches the body length (k = π) with a phase shift.
          // Tail-weighted: amplitude grows from head (0) to tail (max).
          // Thrust-shaped wave: sign(sin) * |sin|^1.6 spends MORE time near
          // 0 (straight body) and snaps quickly to peaks — like a real
          // fish that's mostly rigid and flexes briefly during propulsion.
          float swimT = uTime * 3.6 + vSwimPhase;
          float raw = sin(swimT - r.x / uAspect.x * 3.14159);
          float wave = sign(raw) * pow(abs(raw), 1.6);
          float tailness = (1.0 - r.x / uAspect.x) * 0.5; // 0 at head, 1 at tail
          // Amplitude dropped hard: fish look STRAIGHT 80% of the time,
          // with only a brief tail flick during the thrust phase.
          float bend = wave * tailness * 0.18;

          // Apply bend, then test against a HEAD-BIASED TEARDROP body
          // plus a SLENDER TAIL SPIKE behind it. Body-local coords:
          // u along axis (-1 = tail tip, +1 = forward of head); v
          // perpendicular. Fits entirely in sprite u∈[-1, 0.95].
          //
          // Top-down constraint: this is a viewport-down view of the
          // school, so the caudal fin is edge-on — it should read as a
          // thin streak, NOT a wide forked fan (which would be the
          // side-on view). Tail steepness kept low (0.5) so the spike
          // tapers to ~0.15 max half-width, like the tail end of a
          // torpedo seen from above.
          float yBent = r.y - bend * uAspect.y;
          float u = r.x / uAspect.x;
          float v = yBent / uAspect.y;

          // Body silhouette: head-biased teardrop, head at u=0.95,
          // tail-joint at u=-0.7. Body length 1.65 (close to original
          // 1.9 — restored the "long sardine" silhouette).
          float profile = pow(max(0.0, u + 0.7), 0.6)
                        * pow(max(0.0, 0.95 - u), 0.3);
          bool inBody = abs(v) < profile && u > -0.7 && u < 0.95;

          // Tail spike: thin tapered extension from u=-0.7 to u=-1.0,
          // half-width grows linearly from 0 at joint to ~0.27 at tip.
          // Steepness 0.9 — between the original side-view fan (1.45)
          // and a pure top-down spike (0.5). Reads as a slightly-flared
          // trailing fin without losing the top-down silhouette.
          float tailU = -0.7 - u;            // 0 at body/tail joint, +0.3 at tip
          float halfWidth = tailU * 0.9;
          float vAbs = abs(v);
          bool inTail = u < -0.7 && u > -1.0 && vAbs < halfWidth;

          if (!inBody && !inTail) discard;
          // Body and tail share the fish's color — no dimming. The tail is
          // simply a continuation of the body silhouette.
          gl_FragColor = vec4(vColor, 1.0);
        }
      `,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // ── Bioluminescent halo ──────────────────────────────────────────
    // A second draw sharing the same geometry, with larger gl_PointSize and
    // a soft circular alpha falloff blended additively. Sits BEHIND the
    // hard-pixel main pass via renderOrder, giving each fish a subtle glow
    // without dissolving the pixel-edge identity.
    const haloSizeUniform = {
      value: new THREE.Vector2(baseSize * 1.7, pulseSize * 1.7),
    };
    const haloMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uSize: haloSizeUniform,
        uScale: scaleUniform,
        uPalette: paletteUniform,
        uPaletteAlt: paletteAltUniform,
        uPaletteMix: paletteMixUniform,
        uFocusDrive: focusDriveUniform,
        uBurstBright: burstBrightUniform,
        uSizeMult: sizeMultUniform,
        uTime: timeUniform,
      },
      vertexShader: material.vertexShader,
      fragmentShader: `
        varying vec3 vColor;
        varying float vHeading;
        varying float vSwimPhase;
        void main() {
          // Soft circular halo — vHeading and vSwimPhase are declared to
          // satisfy the shared vertex shader's outputs but neither affects
          // a radial falloff. Multiplying by 0 lets the compiler drop them.
          float ignore = (vHeading + vSwimPhase) * 0.0;
          vec2 c = gl_PointCoord - vec2(0.5);
          float d = length(c) * 2.0;
          float a = 1.0 - smoothstep(0.0, 1.0, d);
          gl_FragColor = vec4(vColor, a * 0.28 + ignore);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const halo = new THREE.Points(geometry, haloMaterial);
    halo.renderOrder = -1;
    scene.add(halo);

    // ── Ambient marine life ────────────────────────────────────────────
    // Background fish drifting across the scene. ~55% are organized into
    // small mini-schools (4–7 fish moving as one — sharing direction +
    // velocity, clustered tightly); the rest are solo wanderers. Real
    // ocean footage shows this exact mix: one focal school plus smaller
    // schools darting around it and lone fish meandering through.
    const ambientCount = isMobile ? 18 : 44;
    const ambientPositions = new Float32Array(ambientCount * 3);
    const ambientIntensities = new Float32Array(ambientCount);
    const ambientSizes = new Float32Array(ambientCount);
    const ambientPaletteIndices = new Float32Array(ambientCount);
    const ambientBrightnesses = new Float32Array(ambientCount);
    const ambientHeadings = new Float32Array(ambientCount); // all zeros — ambient = squares, rotation no-op
    const ambientSwimPhases = new Float32Array(ambientCount);
    const ambientFocusPhases = new Float32Array(ambientCount);
    for (let i = 0; i < ambientCount; i++) {
      ambientSwimPhases[i] = hash01(i * 39769 + 113) * TAU;
      ambientFocusPhases[i] = hash01(i * 24917 + 211);
    }
    const ambientVelocities = new Float32Array(ambientCount * 3);

    const ambientGeometry = new THREE.BufferGeometry();
    ambientGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(ambientPositions, 3),
    );
    ambientGeometry.setAttribute(
      "aIntensity",
      new THREE.BufferAttribute(ambientIntensities, 1),
    );
    ambientGeometry.setAttribute(
      "aSize",
      new THREE.BufferAttribute(ambientSizes, 1),
    );
    ambientGeometry.setAttribute(
      "aPaletteIdx",
      new THREE.BufferAttribute(ambientPaletteIndices, 1),
    );
    ambientGeometry.setAttribute(
      "aBrightness",
      new THREE.BufferAttribute(ambientBrightnesses, 1),
    );
    ambientGeometry.setAttribute(
      "aHeading",
      new THREE.BufferAttribute(ambientHeadings, 1),
    );
    ambientGeometry.setAttribute(
      "aSwimPhase",
      new THREE.BufferAttribute(ambientSwimPhases, 1),
    );
    ambientGeometry.setAttribute(
      "aFocusPhase",
      new THREE.BufferAttribute(ambientFocusPhases, 1),
    );

    const ambientSizeUniform = {
      value: new THREE.Vector2(isMobile ? 2.4 : 3.2, 0),
    };
    // Ambient = square pixel dust (uAspect 1, 1) so the focal wedge stays
    // visually distinct from these background drifters.
    const aspectAmbient = { value: new THREE.Vector2(1.0, 1.0) };
    const ambientMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uSize: ambientSizeUniform,
        uScale: scaleUniform,
        uPalette: paletteUniform,
        uPaletteAlt: paletteAltUniform,
        uPaletteMix: paletteMixUniform,
        uFocusDrive: focusDriveUniform,
        uBurstBright: burstBrightUniform,
        uSizeMult: sizeMultUniform,
        uAspect: aspectAmbient,
        uTime: timeUniform,
      },
      vertexShader: material.vertexShader,
      fragmentShader: material.fragmentShader,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    const ambientPoints = new THREE.Points(ambientGeometry, ambientMaterial);
    scene.add(ambientPoints);

    // World-space bounds the ambient fish wrap around.
    const ambBoundX = 460;
    const ambBoundY = 280;
    const ambBoundZ = 80;

    // Group bookkeeping. `ambientGroupId[i]` = -1 if solo, else index into
    // `ambientGroups`. Followers hold a position offset relative to their
    // group leader (leader has offset 0,0,0).
    interface AmbientGroup {
      leaderIdx: number;
      size: number;
    }
    const ambientGroups: AmbientGroup[] = [];
    const ambientGroupId = new Int32Array(ambientCount);
    const ambientGroupOffsets = new Float32Array(ambientCount * 3);
    ambientGroupId.fill(-1);

    {
      const targetGrouped = Math.floor(ambientCount * 0.55);
      let cursor = 0;
      let assigned = 0;
      while (assigned < targetGrouped && cursor + 3 <= ambientCount) {
        const remaining = targetGrouped - assigned;
        const groupSize = Math.min(
          remaining,
          4 + Math.floor(Math.random() * 4),
        );
        if (groupSize < 3) break;
        const gIdx = ambientGroups.length;
        ambientGroups.push({ leaderIdx: cursor, size: groupSize });
        for (let m = 0; m < groupSize; m++) {
          const mi = cursor + m;
          const m3 = mi * 3;
          ambientGroupId[mi] = gIdx;
          if (m === 0) {
            ambientGroupOffsets[m3] = 0;
            ambientGroupOffsets[m3 + 1] = 0;
            ambientGroupOffsets[m3 + 2] = 0;
          } else {
            // Tight cluster — wider in heading direction, narrower in others.
            ambientGroupOffsets[m3] = (Math.random() - 0.5) * 60;
            ambientGroupOffsets[m3 + 1] = (Math.random() - 0.5) * 22;
            ambientGroupOffsets[m3 + 2] = (Math.random() - 0.5) * 22;
          }
        }
        cursor += groupSize;
        assigned += groupSize;
      }
    }

    /**
     * Spawn or respawn an ambient fish. Followers are no-ops — they're
     * placed by their leader's spawn call.
     *
     * Groups travel ~1.4× faster than solos (small schools dart around
     * the focal school, matching real ocean behavior), and members
     * inherit the leader's velocity exactly so the school stays cohesive.
     */
    const spawnAmbient = (i: number, initial: boolean): void => {
      const groupId = ambientGroupId[i];
      const isLeader = groupId < 0 || ambientGroups[groupId].leaderIdx === i;
      if (!isLeader) return;

      const inGroup = groupId >= 0;
      const r = Math.random();
      const baseSpeed = (inGroup ? 24 : 14) + Math.random() * 28;
      let vx: number;
      let vy: number;
      // Mostly-horizontal swimming with slight up/down. Real fish schools
      // travel along the horizontal plane — strong vertical sweeps were
      // removed because the oval rotates with heading (per shader) but
      // vertical fish look unnatural in a side-profile shot.
      if (r < 0.6) {
        // Rightward — bulk of the flow.
        vx = baseSpeed;
        vy = (Math.random() - 0.5) * baseSpeed * 0.25;
      } else if (r < 0.78) {
        // Slight up-right diagonal (~12° up).
        vx = baseSpeed;
        vy = baseSpeed * (0.15 + Math.random() * 0.15);
      } else if (r < 0.92) {
        // Leftward.
        vx = -baseSpeed;
        vy = (Math.random() - 0.5) * baseSpeed * 0.25;
      } else {
        // Slight down-right diagonal.
        vx = baseSpeed;
        vy = -baseSpeed * (0.15 + Math.random() * 0.15);
      }
      const vz = (Math.random() - 0.5) * 6;

      let startX: number;
      let startY: number;
      if (initial) {
        startX = (Math.random() - 0.5) * ambBoundX * 1.7;
        startY = (Math.random() - 0.5) * ambBoundY * 1.7;
      } else if (vx > 0) {
        startX = -ambBoundX;
        startY = (Math.random() - 0.5) * ambBoundY * 1.6;
      } else {
        startX = ambBoundX;
        startY = (Math.random() - 0.5) * ambBoundY * 1.6;
      }
      const startZ = (Math.random() - 0.5) * ambBoundZ;

      // Pick a palette index for this group/solo. Members of a school share
      // the same "species" colour; brightness varies slightly per member.
      const palRoll = Math.random();
      let groupPalIdx: number;
      if (palRoll < PALETTE_CUMULATIVE[0]) groupPalIdx = 0;
      else if (palRoll < PALETTE_CUMULATIVE[1]) groupPalIdx = 1;
      else if (palRoll < PALETTE_CUMULATIVE[2]) groupPalIdx = 2;
      else if (palRoll < PALETTE_CUMULATIVE[3]) groupPalIdx = 3;
      else groupPalIdx = 4;
      // Ambient is background drift — pop-bright but kept subordinate to the
      // focal wedge through smaller per-particle size.
      const baseBrightness = 0.55 + Math.random() * 0.25;

      const writeMember = (
        idx: number,
        offsetX: number,
        offsetY: number,
        offsetZ: number,
        sizeJitter: number,
        brightnessJitter: number,
      ): void => {
        const m3 = idx * 3;
        ambientPositions[m3] = startX + offsetX;
        ambientPositions[m3 + 1] = startY + offsetY;
        ambientPositions[m3 + 2] = startZ + offsetZ;
        ambientVelocities[m3] = vx;
        ambientVelocities[m3 + 1] = vy;
        ambientVelocities[m3 + 2] = vz;
        const sizeRoll = Math.random();
        const sizeBase = 0.4 + Math.pow(sizeRoll, 1.6) * 2.2;
        ambientSizes[idx] = sizeBase * sizeJitter;
        ambientPaletteIndices[idx] = groupPalIdx;
        // Quantize brightness to 4 discrete steps for the CRT phosphor look.
        const cont = Math.min(
          0.99,
          Math.max(0.25, baseBrightness + brightnessJitter),
        );
        ambientBrightnesses[idx] = Math.floor(cont * 4) / 4;
      };

      // Place leader (or solo).
      writeMember(i, 0, 0, 0, 1.0, 0);

      // If leader of group, place all followers with their offsets and
      // small per-member jitter (similar but not identical = more lifelike).
      if (inGroup) {
        const group = ambientGroups[groupId];
        for (let m = 1; m < group.size; m++) {
          const mi = group.leaderIdx + m;
          const off3 = mi * 3;
          writeMember(
            mi,
            ambientGroupOffsets[off3],
            ambientGroupOffsets[off3 + 1],
            ambientGroupOffsets[off3 + 2],
            0.8 + Math.random() * 0.4,
            (Math.random() - 0.5) * 0.15,
          );
        }
      }
    };

    for (let i = 0; i < ambientCount; i++) spawnAmbient(i, true);
    ambientGeometry.attributes.position.needsUpdate = true;
    ambientGeometry.attributes.aSize.needsUpdate = true;
    ambientGeometry.attributes.aPaletteIdx.needsUpdate = true;
    ambientGeometry.attributes.aBrightness.needsUpdate = true;

    // Signal-wave ring buffer — fixed-size, reused.
    const waves: SignalWave[] = [];
    for (let wi = 0; wi < MAX_WAVES; wi++) {
      waves.push({
        active: false,
        dirX: 1,
        dirY: 0,
        dirZ: 0,
        startProj: 0,
        spanProj: 0,
        startTime: 0,
        strength: 1,
      });
    }
    let nextSpawn =
      WAVE_INTERVAL_MIN +
      Math.random() * (WAVE_INTERVAL_MAX - WAVE_INTERVAL_MIN);

    // ── Cursor state ────────────────────────────────────────────────
    // mouseTarget = raw NDC from last pointermove; mouseNDC lerps toward it
    // each frame for liquid smoothing. cursorWorld is the unprojected
    // world-space position on the z=0 plane. Sentinel 999 = off-screen.
    // In v8 the cursor acts as a PREDATOR — fish flee from it.
    const OFFSCREEN = 999;
    const mouseTarget = new THREE.Vector2(OFFSCREEN, OFFSCREEN);
    const mouseNDC = new THREE.Vector2(OFFSCREEN, OFFSCREEN);
    const cursorWorld = new THREE.Vector3(OFFSCREEN, OFFSCREEN, 0);
    const ndcVec = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    let lastPointerTime = 0;

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      mouseTarget.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseTarget.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      lastPointerTime = performance.now();
    };
    const onPointerLeave = () => {
      mouseTarget.set(OFFSCREEN, OFFSCREEN);
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);

    // ── Attention-mode bridge (HeroAsk → HeroSwarm) ────────────────
    // The orbit is now the DEFAULT — fish always cohere into a loose
    // school around the viewport center. The attention events tighten
    // that orbit into a denser ring while the ask-input is focused:
    //   • swarm:attention-on   → focusStrength ramps to 1 (tight ring)
    //   • swarm:attention-off  → focusStrength ramps back to 0 (loose)
    //   • swarm:submit-burst   → ~600ms vortex collapse + palette flip
    let focusTarget = 0;
    let focusStrength = 0;
    let burstStart = -1e9;
    let lastSimTime = 0;
    const rTargetLoose = isMobile ? R_LOOSE_MOBILE : R_LOOSE_DESKTOP;
    const rTargetFocus = isMobile ? R_FOCUS_MOBILE : R_FOCUS_DESKTOP;

    const onAttentionOn = () => {
      focusTarget = 1;
    };
    const onAttentionOff = () => {
      focusTarget = 0;
    };
    const onSubmitBurst = () => {
      burstStart = lastSimTime;
    };
    window.addEventListener("swarm:attention-on", onAttentionOn);
    window.addEventListener("swarm:attention-off", onAttentionOff);
    window.addEventListener("swarm:submit-burst", onSubmitBurst);

    // ── Scroll-follow plumbing ─────────────────────────────────────
    // The orbit center is the WORLD-SPACE projection of the current
    // viewport center. As the user scrolls, the canvas (absolute inset:0
    // of the hero section, clipped by hero's overflow-hidden) scrolls
    // with the page; we recompute the viewport center in canvas-local
    // coords each frame so the school always sits in view while any
    // part of the hero is visible. While the user is actively scrolling
    // we relax the orbit weight so the fish read as "swimming freely"
    // rather than rigidly tracking the scroll position.
    let lastScrollY = typeof window !== "undefined" ? window.scrollY : 0;
    let scrollVel = 0;
    let lastScrollAt = -1e9;
    const onScroll = () => {
      scrollVel = Math.abs(window.scrollY - lastScrollY);
      lastScrollY = window.scrollY;
      lastScrollAt = performance.now();
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const orbitCenterWorld = new THREE.Vector3(0, 0, 0);
    const orbitNdc = new THREE.Vector3();
    const orbitCamDir = new THREE.Vector3();
    const viewportCenterTarget = new THREE.Vector2(0, 0);
    const viewportCenterSmoothed = new THREE.Vector2(0, 0);

    const t0 = performance.now();
    let raf = 0;
    let cancelled = false;
    let lastTime = -1;

    const renderFrame = (timeSec: number) => {
      // Time delta for frame-rate-independent motion. Cap at 50ms to avoid
      // teleporting fish if the tab was backgrounded.
      const dt = lastTime < 0 ? 0 : Math.min(0.05, timeSec - lastTime);
      lastTime = timeSec;
      lastSimTime = timeSec;
      // Drive the shader-side swim animation.
      timeUniform.value = timeSec;

      // ── Focus strength (smoothed input-focus state) ──────────────
      // Lerp toward focusTarget. Drives orbit-tightening, not orbit-on/off
      // — the orbit itself is always on (see "base orbit" below).
      const lerpRate =
        focusTarget > focusStrength ? ATTENTION_LERP_IN : ATTENTION_LERP_OUT;
      focusStrength +=
        (focusTarget - focusStrength) *
        Math.min(1, lerpRate * Math.max(0.0001, dt) * 60);

      // ── Submit burst envelope (0..1 over BURST_TOTAL seconds) ────
      let burstStrength = 0;
      const tBurst = timeSec - burstStart;
      if (tBurst >= 0 && tBurst < BURST_TOTAL) {
        if (tBurst < BURST_RISE) {
          burstStrength = tBurst / BURST_RISE;
        } else if (tBurst < BURST_RISE + BURST_HOLD) {
          burstStrength = 1;
        } else {
          burstStrength = 1 - (tBurst - BURST_RISE - BURST_HOLD) / BURST_DECAY;
        }
      }

      // Effective focus including the burst — keeps the orbit tight
      // through the submit collapse even if the input already blurred.
      const fEff = Math.max(focusStrength, burstStrength);

      // ── Focus-stagger palette drive ──────────────────────────────
      // uFocusDrive ramps with focusStrength: 0 → 0.65 so every fish's
      // cascade gate (smoothstep at aFocusPhase*0.5 .. +0.15) opens by
      // drive peak. Once open, the shader's per-fish sinusoidal flicker
      // (uTime + aFocusPhase*2π) handles the "Solana colors alternating
      // on/off" effect — no JS sinusoid needed.
      focusDriveUniform.value = focusStrength * 0.65;

      // Drive shader uniforms from the focus + burst envelopes.
      paletteMixUniform.value = burstStrength;
      // Brightness: focus adds a 0.45 lift so the Solana palette reads
      // as NEON GLOW (not just a color swap at the same brightness).
      // Burst still peaks higher (+0.8) for the climactic moment. Use
      // max() so the two paths don't double up.
      burstBrightUniform.value =
        1.0 + Math.max(0.45 * focusStrength, 0.8 * burstStrength);
      // Size multiplier: 1.0 baseline → SIZE_MULT_FOCUS during steady
      // focus, lerping to SIZE_MULT_BURST at burst peak.
      const focusSizeMult = 1.0 + (SIZE_MULT_FOCUS - 1.0) * focusStrength;
      sizeMultUniform.value =
        focusSizeMult + (SIZE_MULT_BURST - focusSizeMult) * burstStrength;

      // ── Orbit center = viewport center, projected into world ─────
      // Canvas is `position: absolute; inset: 0` of the hero section
      // (clipped by `overflow: hidden`), so it scrolls with the page.
      // We reproject the live viewport center into canvas-local NDC
      // each frame so fish track the visible region as the user scrolls
      // through the hero. Smoothing is intentionally fast (~40ms time
      // constant) — earlier tuning had a sluggish ~125ms lag that made
      // scroll-down-then-back-up feel slow to recover.
      let orbitCenterValid = false;
      const cRect = container.getBoundingClientRect();
      if (cRect.width > 0 && cRect.height > 0) {
        const vpCenterX = window.innerWidth / 2;
        const vpCenterY = window.innerHeight / 2;
        const localX = vpCenterX - cRect.left;
        const localY = vpCenterY - cRect.top;
        const rawNdcX = (localX / cRect.width) * 2 - 1;
        const rawNdcY = -((localY / cRect.height) * 2 - 1);
        // When the viewport center is OUTSIDE the canvas (user has
        // scrolled past the hero), fall back to canvas center (0, 0)
        // for the orbit target. Without this, the orbit center chases
        // wildly out-of-range NDC values (e.g. y = -4.4 at scrollY=2000),
        // pulling fish off into world coords far from the canvas. When
        // the user scrolls back to the hero, fish are physically far
        // away and have to swim back into view — looks like an empty
        // tank for ~1s. Holding the orbit at canvas center while the
        // hero is off-screen keeps fish in place, so scrolling back up
        // shows the swarm exactly where it was.
        const insideCanvas = Math.abs(rawNdcX) <= 1 && Math.abs(rawNdcY) <= 1;
        viewportCenterTarget.x = insideCanvas ? rawNdcX : 0;
        viewportCenterTarget.y = insideCanvas ? rawNdcY : 0;

        // Frame-rate-independent smoothing toward the new target.
        // dt*40 ≈ 25ms time constant — orbit center snaps to viewport
        // almost instantly so scroll-back-up shows fish back in place
        // immediately rather than catching up over a perceptible beat.
        const smooth = 1 - Math.exp(-dt * 40);
        viewportCenterSmoothed.lerp(viewportCenterTarget, smooth);

        orbitNdc
          .set(viewportCenterSmoothed.x, viewportCenterSmoothed.y, 0.5)
          .unproject(camera);
        orbitCamDir.copy(orbitNdc).sub(camera.position).normalize();
        const tParam = -camera.position.z / orbitCamDir.z;
        orbitCenterWorld
          .copy(camera.position)
          .addScaledVector(orbitCamDir, tParam);
        orbitCenterValid = true;
      }

      // ── Orbit target radius + speed (loose by default, tight on focus) ─
      const looseR = rTargetLoose + (rTargetFocus - rTargetLoose) * fEff;
      const orbitRTarget =
        looseR * (1 - burstStrength) + R_TARGET_BURST * burstStrength;
      // Loose orbit is deliberate + graceful (real bait-ball pace); focus
      // speeds it up; burst pushes to its own (slow, collapsing) target.
      const looseV = V_ORBIT_FOCUS * (0.4 + 0.6 * fEff);
      const orbitVOrbit =
        looseV * (1 - burstStrength) + V_ORBIT_BURST * burstStrength;

      // Scroll-induced relaxation. While the user is actively scrolling
      // we slightly soften the orbit grip so the school doesn't feel
      // like it's nailed to the cursor, but we KEEP the orbit force
      // dominant so the ring formation holds together throughout the
      // scroll. Earlier tuning relaxed too aggressively (55% off) with
      // a slow recovery (~400ms), which made the fish bunch up while
      // off-screen and look like a clump when the user scrolled back
      // into view. Now: 15% max relaxation, recovery in ~125ms.
      const sinceScroll = (performance.now() - lastScrollAt) / 1000;
      const scrolling =
        Math.min(1, scrollVel / 12) * Math.exp(-sinceScroll * 8);
      scrollVel *= Math.exp(-dt * 5);

      // Base orbit weight is always positive — fish are always orbiting
      // the viewport. Scroll relaxes it slightly; nothing turns it off.
      const orbitWeight = 0.7 * (1 - 0.15 * scrolling);
      // Predator (cursor) flee is suppressed by focus — committed orbit
      // fish ignore the cursor — but loose-orbit fish still react.
      const predatorWeight = 1 - 0.6 * fEff;

      // ── Cursor projection ───────────────────────────────────────────
      // Touch-device timeout: if no pointermove for 1.2 s, retire the cursor.
      // pointerleave doesn't fire reliably after taps on touch devices.
      if (
        mouseTarget.x !== OFFSCREEN &&
        performance.now() - lastPointerTime > 1200
      ) {
        mouseTarget.set(OFFSCREEN, OFFSCREEN);
      }
      if (mouseTarget.x !== OFFSCREEN) {
        mouseNDC.lerp(mouseTarget, 0.12);
        // Unproject NDC to the school's z=0 plane.
        ndcVec.set(mouseNDC.x, mouseNDC.y, 0.5).unproject(camera);
        camDir.copy(ndcVec).sub(camera.position).normalize();
        const tParam = -camera.position.z / camDir.z;
        cursorWorld.copy(camera.position).addScaledVector(camDir, tParam);
      } else {
        cursorWorld.x = OFFSCREEN;
        mouseNDC.set(OFFSCREEN, OFFSCREEN);
      }

      // ── Wave scheduler ─────────────────────────────────────────────
      // Pure-stochastic directional sweeps. No phase coupling, no cycle —
      // just random angles, random strengths, random cadence. The eye
      // can't lock onto a pattern, so the swarm reads as continuously alive.
      const spawnWave = (
        angle: number,
        strength: number,
        zBias: number,
      ): boolean => {
        for (let wi = 0; wi < waves.length; wi++) {
          if (!waves[wi].active) {
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            const dz = zBias;
            const dlen = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const ndx = dx / dlen;
            const ndy = dy / dlen;
            const ndz = dz / dlen;
            // Wave projection spans the canvas bounding box. Computed
            // analytically from BOUND_X / BOUND_Y / z-extent — no per-fish
            // loop needed (was iterating homePositions in the wedge era).
            const maxProj =
              BOUND_X * Math.abs(ndx) +
              BOUND_Y * Math.abs(ndy) +
              24 * Math.abs(ndz);
            const minProj = -maxProj;
            waves[wi].active = true;
            waves[wi].dirX = ndx;
            waves[wi].dirY = ndy;
            waves[wi].dirZ = ndz;
            waves[wi].startProj = minProj - waveWidth * 2;
            waves[wi].spanProj = maxProj - minProj + waveWidth * 4;
            waves[wi].startTime = timeSec;
            waves[wi].strength = strength;
            return true;
          }
        }
        return false;
      };

      if (timeSec >= nextSpawn) {
        const angle = Math.random() * TAU;
        // Softer peak strength — was 0.5..1.0, now 0.35..0.75. Combined
        // with the narrower brightness range below this reduces the
        // overall sparkle from "chaotic" to "alive."
        const strength = 0.35 + Math.random() * 0.4;
        spawnWave(angle, strength, (Math.random() - 0.5) * 0.3);
        nextSpawn =
          timeSec +
          WAVE_INTERVAL_MIN +
          Math.random() * (WAVE_INTERVAL_MAX - WAVE_INTERVAL_MIN);
      }

      for (let wi = 0; wi < waves.length; wi++) {
        if (waves[wi].active && timeSec - waves[wi].startTime > WAVE_DURATION) {
          waves[wi].active = false;
        }
      }

      const cursorActive = cursorWorld.x !== OFFSCREEN;
      const cursorX = cursorWorld.x;
      const cursorY = cursorWorld.y;

      // ── Build spatial hash ─────────────────────────────────────────
      // O(N): each fish dropped into the cell containing its position.
      // Bucket overflow self-corrects within a frame as cohesion relaxes.
      spatialHash.clear();
      for (let i = 0; i < count; i++) {
        spatialHash.insert(i, positions[i * 3], positions[i * 3 + 1]);
      }
      const cellsX = spatialHash.cellsX;
      const cellsY = spatialHash.cellsY;
      const bucketSize = spatialHash.bucketSize;
      const buckets = spatialHash.buckets;
      const cellCounts = spatialHash.counts;

      // Acceleration scale converts per-frame unit-magnitude forces into
      // per-second world-unit accelerations. With sum-of-weights ≈ 1.1
      // and ACCEL_SCALE = 54, max accel ≈ 60 units/sec² — fish reach
      // MAX_SPEED (18) in ~0.3s under predator escape.
      const ACCEL_SCALE = 54;
      const dtScaled = dt; // dt is already in seconds

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const i2 = i * 2;

        const px = positions[i3];
        const py = positions[i3 + 1];
        const pz = positions[i3 + 2];
        const myVx = velocities[i2];
        const myVy = velocities[i2 + 1];

        // ── Boids force accumulators ───────────────────────────────
        let sepX = 0,
          sepY = 0;
        let aliX = 0,
          aliY = 0;
        let cohX = 0,
          cohY = 0;

        // Query 3×3 cells around the fish's cell. The spatial hash drops
        // brute-force O(N²) to O(N·k) where k ≈ average neighbors per cell.
        const myCx = Math.min(
          cellsX - 1,
          Math.max(0, Math.floor((px + BOUND_X) / CELL_SIZE)),
        );
        const myCy = Math.min(
          cellsY - 1,
          Math.max(0, Math.floor((py + BOUND_Y) / CELL_SIZE)),
        );
        for (let ddx = -1; ddx <= 1; ddx++) {
          const ncx = myCx + ddx;
          if (ncx < 0 || ncx >= cellsX) continue;
          for (let ddy = -1; ddy <= 1; ddy++) {
            const ncy = myCy + ddy;
            if (ncy < 0 || ncy >= cellsY) continue;
            const cellIdx = ncy * cellsX + ncx;
            const start = cellIdx * bucketSize;
            const cnt = cellCounts[cellIdx];
            for (let k = 0; k < cnt; k++) {
              const j = buckets[start + k];
              if (j === i) continue;
              const j3 = j * 3;
              const j2 = j * 2;
              const dx = px - positions[j3];
              const dy = py - positions[j3 + 1];
              const distSq = dx * dx + dy * dy;
              if (distSq > COH_R_SQ) continue;
              const dist = Math.sqrt(distSq) + 1e-6;
              // Separation: stronger when closer; direction = away from j
              if (distSq < SEP_R_SQ) {
                const w = (1 - dist / SEP_R) / dist;
                sepX += dx * w;
                sepY += dy * w;
              }
              // Alignment: weighted by inverse distance; direction = j's vel
              if (distSq < ALI_R_SQ) {
                const jVx = velocities[j2];
                const jVy = velocities[j2 + 1];
                const jSp = Math.sqrt(jVx * jVx + jVy * jVy) + 1e-6;
                const w = (1 - dist / ALI_R) / jSp;
                aliX += jVx * w;
                aliY += jVy * w;
              }
              // Cohesion: pulls toward j; direction = toward j (negate dx,dy)
              if (distSq < COH_R_SQ) {
                const w = (1 - dist / COH_R) / dist;
                cohX += -dx * w;
                cohY += -dy * w;
              }
            }
          }
        }

        // Clamp each Boids force to unit magnitude (vetemaa's optimized
        // mode). Forces are now in [0, 1], comparable, weight-scalable.
        const sepLen = Math.sqrt(sepX * sepX + sepY * sepY);
        if (sepLen > 1) {
          sepX /= sepLen;
          sepY /= sepLen;
        }
        const aliLen = Math.sqrt(aliX * aliX + aliY * aliY);
        if (aliLen > 1) {
          aliX /= aliLen;
          aliY /= aliLen;
        }
        const cohLen = Math.sqrt(cohX * cohX + cohY * cohY);
        if (cohLen > 1) {
          cohX /= cohLen;
          cohY /= cohLen;
        }

        // ── Bounds force (elliptical, recentered on orbit) ─────────
        // Old rectangular bounds at (0,0) produced a wide, short ribbon.
        // New: a soft elliptical shell centered on the CURRENT orbit
        // center (which tracks viewport center). Fish always live in a
        // rounded school around wherever the user's attention is.
        let bndX = 0,
          bndY = 0;
        const dxBnd = px - orbitCenterWorld.x;
        const dyBnd = py - orbitCenterWorld.y;
        const ex = dxBnd / BOUND_A;
        const ey = dyBnd / BOUND_B;
        const r2 = ex * ex + ey * ey;
        if (r2 > BOUND_SHELL_SQ) {
          const r = Math.sqrt(r2);
          const shell = Math.sqrt(BOUND_SHELL_SQ);
          let push = (r - shell) / (1 - shell);
          if (push > 1) push = 1;
          bndX = -(ex / r) * push;
          bndY = -(ey / r) * push;
        }

        // ── Predator avoidance (cursor) — flee force + panic injection ─
        // Two-tier escape: at the outer radius (PRED_R) the standard Boids
        // flee force applies (gentle accel). Inside the PANIC_R inner
        // radius, the fish "panics" — velocity is DIRECTLY blended toward
        // a high-speed escape vector. This makes close fish actually look
        // like they're being chased rather than slowly steering away.
        let fleeX = 0,
          fleeY = 0;
        let panicActive = false;
        let panicVx = 0;
        let panicVy = 0;
        if (cursorActive) {
          const dxc = px - cursorX;
          const dyc = py - cursorY;
          const dcSq = dxc * dxc + dyc * dyc;
          if (dcSq < PRED_R_SQ) {
            const dc = Math.sqrt(dcSq) + 1e-6;
            const w = (1 - dc / PRED_R) / dc;
            fleeX = dxc * w;
            fleeY = dyc * w;
            const fleeLen = Math.sqrt(fleeX * fleeX + fleeY * fleeY);
            if (fleeLen > 1) {
              fleeX /= fleeLen;
              fleeY /= fleeLen;
            }
            // Panic zone — close enough that the fish would be "caught."
            if (dcSq < PANIC_R_SQ) {
              panicActive = true;
              const escapeFracIn = 1 - dc / PANIC_R; // 0 at edge, 1 at cursor
              const targetSpeed =
                MAX_SPEED + (PANIC_SPEED - MAX_SPEED) * escapeFracIn;
              panicVx = (dxc / dc) * targetSpeed;
              panicVy = (dyc / dc) * targetSpeed;
            }
          }
        }

        // ── Wander ────────────────────────────────────────────────
        const wandX = Math.random() - 0.5;
        const wandY = Math.random() - 0.5;

        // ── Orbital steering (attention mode) ─────────────────────
        // Radial spring toward `orbitRTarget` + tangential bias (CCW).
        // Output is in real accel units; combined into ax/ay below
        // with `orbitWeight` so it ramps in/out smoothly with focus.
        let orbitAx = 0;
        let orbitAy = 0;
        if (orbitCenterValid && orbitWeight > 0.001) {
          const odx = px - orbitCenterWorld.x;
          const ody = py - orbitCenterWorld.y;
          const orR = Math.sqrt(odx * odx + ody * ody) + 1e-6;
          // Tangential = radial rotated 90° (counter-clockwise viewed
          // from the camera).
          const tngX = -ody / orR;
          const tngY = odx / orR;
          // Per-fish preferred radius: only applies at loose. At focus,
          // all fish converge to the same tight ring.
          const perFishR = orbitRTarget + radiusOffsets[i] * (1 - fEff);
          // Radial spring toward this fish's preferred radius.
          const radialErr = (orR - perFishR) / perFishR;
          const radX = (-odx / orR) * radialErr;
          const radY = (-ody / orR) * radialErr;
          // Radial gain ramps with focus — at loose, fish swirl around R
          // without strictly snapping to it; at focus, full converge.
          const radialGain =
            V_RADIAL_GAIN_LOOSE + (V_RADIAL_GAIN - V_RADIAL_GAIN_LOOSE) * fEff;
          // Per-fish orbital speed mult (only at loose — focus
          // synchronizes them for the tight-ring effect).
          const fishSpeedMult = 1 + (speedMults[i] - 1) * (1 - fEff);
          const desVx = tngX * orbitVOrbit * fishSpeedMult + radX * radialGain;
          const desVy = tngY * orbitVOrbit * fishSpeedMult + radY * radialGain;
          orbitAx = (desVx - myVx) * K_STEER;
          orbitAy = (desVy - myVy) * K_STEER;
        }

        // ── Combine forces → acceleration ─────────────────────────
        // Predator weight is suppressed by attention (fish stop fleeing
        // the cursor mid-orbit). The orbit term adds on top — Boids
        // forces are NOT scaled down so separation + bounds still apply
        // and keep the school well-spaced and contained.
        const ax =
          (sepX * W_SEP +
            aliX * W_ALI +
            cohX * W_COH +
            bndX * W_BND +
            fleeX * W_PRED * predatorWeight +
            wandX * W_RAND) *
            ACCEL_SCALE +
          orbitAx * orbitWeight;
        const ay =
          (sepY * W_SEP +
            aliY * W_ALI +
            cohY * W_COH +
            bndY * W_BND +
            fleeY * W_PRED * predatorWeight +
            wandY * W_RAND) *
            ACCEL_SCALE +
          orbitAy * orbitWeight;

        // ── Integrate velocity, clamp speed, integrate position ───
        let nvx = myVx + ax * dtScaled;
        let nvy = myVy + ay * dtScaled;
        const sp = Math.sqrt(nvx * nvx + nvy * nvy);
        if (sp > MAX_SPEED) {
          nvx = (nvx * MAX_SPEED) / sp;
          nvy = (nvy * MAX_SPEED) / sp;
        }
        // Panic injection — instantaneous velocity blend toward escape.
        // Bypasses the slow accel build-up so close fish actually look like
        // they're fleeing for their lives rather than gently drifting away.
        // Allowed to exceed MAX_SPEED (clamped to PANIC_SPEED via target).
        if (panicActive) {
          nvx = nvx * (1 - PANIC_BLEND) + panicVx * PANIC_BLEND;
          nvy = nvy * (1 - PANIC_BLEND) + panicVy * PANIC_BLEND;
          const panicSp = Math.sqrt(nvx * nvx + nvy * nvy);
          if (panicSp > PANIC_SPEED) {
            nvx = (nvx * PANIC_SPEED) / panicSp;
            nvy = (nvy * PANIC_SPEED) / panicSp;
          }
        }
        let nx = px + nvx * dtScaled;
        let ny = py + nvy * dtScaled;
        // Slow z-drift so fish swim toward/away from camera. Bounce inside
        // [-110, 110] for the wider z spread (more visible 3D layering).
        let nz = pz + zSpeeds[i] * dtScaled;
        if (nz < -110) {
          nz = -110;
          zSpeeds[i] = -zSpeeds[i];
        } else if (nz > 110) {
          nz = 110;
          zSpeeds[i] = -zSpeeds[i];
        }
        // Hard bounds wall: safety net if a fish has somehow crossed the
        // elliptical soft shell (strong predator + transient). Clamp onto
        // the hard ellipse (slightly larger than the soft shell) and reflect
        // the outward velocity component with damping. Recentered on the
        // current orbit center so the safety net follows the school.
        const hardA = BOUND_A * 1.15;
        const hardB = BOUND_B * 1.15;
        const hdx = nx - orbitCenterWorld.x;
        const hdy = ny - orbitCenterWorld.y;
        const hex = hdx / hardA;
        const hey = hdy / hardB;
        const hr2 = hex * hex + hey * hey;
        if (hr2 > 1) {
          const hr = Math.sqrt(hr2);
          // Pull back to the ellipse surface
          nx = orbitCenterWorld.x + hdx / hr;
          ny = orbitCenterWorld.y + hdy / hr;
          // Outward unit normal (in unstretched space)
          const nrmX = hex / hr;
          const nrmY = hey / hr;
          // Reflect velocity if moving outward (along ellipse normal direction)
          const vOut = nvx * nrmX + nvy * nrmY;
          if (vOut > 0) {
            nvx -= 1.5 * vOut * nrmX;
            nvy -= 1.5 * vOut * nrmY;
          }
        }
        positions[i3] = nx;
        positions[i3 + 1] = ny;
        positions[i3 + 2] = nz;
        velocities[i2] = nvx;
        velocities[i2 + 1] = nvy;

        // ── Heading: smoothed toward velocity direction + body sway ──
        // Fish rotate with INERTIA — heading lerps toward the velocity-
        // direction target instead of snapping. Eliminates per-frame
        // tremble while letting fish turn responsively (~70ms half-life).
        // A small, slow whole-body sway is layered on top so fish read
        // as actively swimming, not gliding.
        const finalSp = Math.sqrt(nvx * nvx + nvy * nvy);
        let targetHeading: number;
        if (finalSp > 0.5) {
          targetHeading = Math.atan2(nvy, nvx);
        } else {
          targetHeading = headings[i];
        }
        // Frame-rate-independent heading smoothing — faster than the
        // first pass so fish can flee/turn responsively but no tremble.
        const headingSmooth = 1 - Math.exp(-dt * 10);
        let dh = targetHeading - headings[i];
        if (dh > Math.PI) dh -= TAU;
        else if (dh < -Math.PI) dh += TAU;
        headings[i] += dh * headingSmooth;
        // Subtle body sway — ~1° amplitude, 3 Hz cadence, desynchronized
        // per fish. Adds "alive swimming" feel without any tremble.
        const swayFreq = 3.0;
        const swayAmp = 0.018;
        headings[i] += Math.sin(timeSec * swayFreq + swimPhases[i]) * swayAmp;

        // ── Wave intensity (random brightness pops) ───────────────
        // Wave projection now in WORLD space — Boids fish move freely so
        // wave detection uses their current position.
        let waveIntensity = 0;
        for (let wi = 0; wi < waves.length; wi++) {
          const wave = waves[wi];
          if (!wave.active) continue;
          const elapsed = timeSec - wave.startTime;
          const wavePos =
            wave.startProj + wave.spanProj * (elapsed / WAVE_DURATION);
          const proj = px * wave.dirX + py * wave.dirY + pz * wave.dirZ;
          const norm = (wavePos - proj) / waveWidth;
          const env =
            (norm >= 0
              ? Math.exp(-norm * norm * 0.6)
              : Math.exp(-norm * norm * 6)) * wave.strength;
          if (env > waveIntensity) waveIntensity = env;
        }

        // Calm default brightness — wave amp 0.15 so individual fish don't
        // flash. Focus mode bumps amplitude back up (Phase 2 reveal): the
        // swarm visibly "thinks louder" while the input is focused.
        const waveAmpBoost = 0.15 + 0.3 * fEff;
        const intensityBoost = 0.25 + 0.3 * fEff;
        const continuous = 0.6 + waveIntensity * waveAmpBoost;
        const clamped = continuous > 1 ? 1 : continuous;
        brightnesses[i] = Math.floor(clamped * 4 + 0.0001) / 4;
        intensities[i] = waveIntensity * intensityBoost;
      }

      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.aBrightness.needsUpdate = true;
      geometry.attributes.aIntensity.needsUpdate = true;
      geometry.attributes.aHeading.needsUpdate = true;

      // Ambient marine life — advance positions, respawn at edges. Only
      // leaders + solos are bounds-checked; group followers respawn as a
      // unit when their leader does.
      if (dt > 0) {
        for (let i = 0; i < ambientCount; i++) {
          const i3 = i * 3;
          ambientPositions[i3] += ambientVelocities[i3] * dt;
          ambientPositions[i3 + 1] += ambientVelocities[i3 + 1] * dt;
          ambientPositions[i3 + 2] += ambientVelocities[i3 + 2] * dt;
        }
        let respawned = false;
        for (let i = 0; i < ambientCount; i++) {
          const groupId = ambientGroupId[i];
          if (groupId >= 0 && ambientGroups[groupId].leaderIdx !== i) {
            continue;
          }
          const i3 = i * 3;
          const ax = ambientPositions[i3];
          const ay = ambientPositions[i3 + 1];
          if (
            ax > ambBoundX ||
            ax < -ambBoundX ||
            ay > ambBoundY ||
            ay < -ambBoundY
          ) {
            spawnAmbient(i, false);
            respawned = true;
          }
        }
        ambientGeometry.attributes.position.needsUpdate = true;
        if (respawned) {
          ambientGeometry.attributes.aPaletteIdx.needsUpdate = true;
          ambientGeometry.attributes.aBrightness.needsUpdate = true;
          ambientGeometry.attributes.aSize.needsUpdate = true;
        }
      }

      renderer.render(scene, camera);
    };

    const tick = () => {
      if (cancelled) return;
      const time = (performance.now() - t0) / 1000;
      renderFrame(time);
      raf = requestAnimationFrame(tick);
    };

    if (reduceMotion) {
      renderFrame(0);
    } else {
      raf = requestAnimationFrame(tick);
    }

    const ro = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const newW = Math.max(1, rect.width);
      const newH = Math.max(1, rect.height);
      renderer.setSize(newW, newH);
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      scaleUniform.value = renderer.domElement.height / 2;
    });
    ro.observe(container);

    return () => {
      cancelled = true;
      if (raf !== 0) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("swarm:attention-on", onAttentionOn);
      window.removeEventListener("swarm:attention-off", onAttentionOff);
      window.removeEventListener("swarm:submit-burst", onSubmitBurst);
      window.removeEventListener("scroll", onScroll);
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      haloMaterial.dispose();
      ambientGeometry.dispose();
      ambientMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 2,
      }}
    />
  );
}
