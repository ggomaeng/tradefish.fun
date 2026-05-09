"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Hero fish-swarm v3 — one cohesive swarm, signal contagion, consensus.
 *
 * The 12k particles always live inside one fish silhouette (no morph cycle,
 * no separate schools). Three layered behaviors:
 *
 *  1. **Per-particle breath orbits.** Each particle wobbles on its own
 *     deterministic micro-pattern (3-axis sine with hashed freqs/phases/amps).
 *     Stagger without sync — the body is alive but never falls apart.
 *
 *  2. **Signal contagion.** Random particles emit green pulses; the wave
 *     spreads outward through home-position distance with a Gaussian
 *     envelope. Up to 4 concurrent waves. Visualizes inter-agent signal
 *     exchange.
 *
 *  3. **Consensus convergence cycle.** Every 12s the whole body's hues
 *     pull together: random drift → all green → release. Visualizes the
 *     emergence of a market consensus across the agent swarm.
 *
 * Performance budget: 12k particles × ~25 mul/add per particle per frame
 * + 4 wave intensity lookups stays well under 16ms. Inner loop is
 * allocation-free.
 *
 * Honors prefers-reduced-motion (renders one static frame at t=0).
 * StrictMode-safe: cleans up renderer / geometry / RAF / ResizeObserver.
 */

const TAU = Math.PI * 2;
const GOLDEN = 2.39996322972865332;

// HSL hue for the consensus / signal color. 0.36 ≈ #7fe0a8 (brand phosphor).
const GREEN_HUE = 0.36;
const SWIM_SPEED = 0.55;
const WIGGLE_AMP = 2.6;

// Signal contagion — directional sweeps across the school. Up to 3
// concurrent waves so DIVERGE phase reads as multiple agents debating
// at once; CONSENSUS phase issues a single decisive horizontal broadcast.
const MAX_WAVES = 3;
const WAVE_DURATION = 5.0;
// Spawn cadence varies by consensus phase — see scheduler in renderFrame.
// These are the diverge-phase defaults (rapid back-and-forth chatter).
const WAVE_INTERVAL_MIN = 0.35;
const WAVE_INTERVAL_MAX = 1.1;

// Consensus convergence (12s loop)
const CONSENSUS_CYCLE = 12;
const PHASE_DIVERGE_END = 6 / 12;
const PHASE_CONVERGE_END = 9 / 12;
const PHASE_CONSENSUS_END = 11 / 12;

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
 * Lens-shape school formation — particles randomly scattered within an
 * elongated horizontal ellipsoid. No tail fork: real fish schools form
 * lens / oval clouds, and dropping the tail removes the visual ambiguity
 * of "is this one big fish or a school of fish".
 *
 * Cross-section profile blends a flat 0.45 floor with a 0.55 sin bump,
 * so endpoints retain ~45% of the central thickness instead of tapering
 * to a point. This keeps inter-particle spacing roughly even across the
 * entire school instead of clumping particles into thin lines at the tips.
 *
 * Radial position uses `sqrt(r)` so particles are uniformly distributed
 * across cross-section area (no center clumping).
 */
function buildSchoolFormation(
  out: Float32Array,
  n: number,
  length: number,
  height: number,
  depth: number,
): void {
  for (let i = 0; i < n; i++) {
    const idx = i * 3;
    const r1 = hash01(i * 1811 + 17);
    const r2 = hash01(i * 1811 + 23);
    const r3 = hash01(i * 1811 + 29);

    const t = r1;
    const profile = 0.45 + 0.55 * Math.sin(t * Math.PI);
    const innerR = Math.sqrt(r2);
    const angle = r3 * TAU;

    out[idx] = (t - 0.5) * length;
    out[idx + 1] = Math.cos(angle) * profile * height * 0.5 * innerR;
    out[idx + 2] = Math.sin(angle) * profile * depth * 0.5 * innerR;
  }
}

/**
 * Per-particle micro-motion seeds — 9 floats per particle: 3 frequencies,
 * 3 phase offsets, 3 amplitudes. Deterministic from index.
 *
 * Frequencies in 0.35..1.4 rad/sec range, amplitudes 1.5..5.5 units. With
 * the sparse-school layout (~12 unit spacing), this gives each particle a
 * visibly distinct wobble without colliding with its neighbors.
 */
function buildBreathParams(out: Float32Array, n: number): void {
  for (let i = 0; i < n; i++) {
    const j = i * 9;
    out[j] = 0.35 + hash01(i * 7919 + 1) * 1.05;
    out[j + 1] = 0.35 + hash01(i * 7919 + 2) * 1.05;
    out[j + 2] = 0.35 + hash01(i * 7919 + 3) * 1.05;
    out[j + 3] = hash01(i * 7919 + 4) * TAU;
    out[j + 4] = hash01(i * 7919 + 5) * TAU;
    out[j + 5] = hash01(i * 7919 + 6) * TAU;
    out[j + 6] = 0.6 + hash01(i * 7919 + 7) * 2.0;
    out[j + 7] = 0.6 + hash01(i * 7919 + 8) * 2.0;
    out[j + 8] = 0.6 + hash01(i * 7919 + 9) * 2.0;
  }
}

/**
 * Per-particle hue seeds — 2 floats: base hue [0,1) and drift speed.
 * During the divergent phase each particle slowly cycles through its own
 * personal hue. Consensus phase pulls them all toward GREEN_HUE.
 */
function buildHueSeeds(out: Float32Array, n: number): void {
  for (let i = 0; i < n; i++) {
    const j = i * 2;
    out[j] = hash01(i * 104729 + 11);
    out[j + 1] = 0.04 + hash01(i * 104729 + 13) * 0.1;
  }
}

/**
 * Consensus phase factor [0..1] across the 12s cycle.
 *  0–6s   diverge   → 0
 *  6–9s   converge  → smoothstep 0..1
 *  9–11s  consensus → 1
 *  11–12s release   → smoothstep 1..0
 */
function consensusFactor(timeSec: number): number {
  const t = (timeSec % CONSENSUS_CYCLE) / CONSENSUS_CYCLE;
  if (t < PHASE_DIVERGE_END) return 0;
  if (t < PHASE_CONVERGE_END) {
    const u =
      (t - PHASE_DIVERGE_END) / (PHASE_CONVERGE_END - PHASE_DIVERGE_END);
    return u * u * (3 - 2 * u);
  }
  if (t < PHASE_CONSENSUS_END) return 1;
  const u = (t - PHASE_CONSENSUS_END) / (1 - PHASE_CONSENSUS_END);
  return 1 - u * u * (3 - 2 * u);
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
    // School: ~800 particles in a lens-shape ellipsoid school formation.
    // Aspect ratio length:height:depth ≈ 2.5 : 1 : 0.45 for a classic
    // side-view sardine-school silhouette.
    const count = isMobile ? 350 : 800;
    const length = isMobile ? 220 : 320;
    const height = isMobile ? 90 : 130;
    const depth = isMobile ? 40 : 60;
    const halfLen = length / 2;
    // Wave: directional plane sweep across the school. Wider envelope so
    // a substantial slab of fish lights up at once (more dramatic).
    const waveWidth = isMobile ? 26 : 36;

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
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const intensities = new Float32Array(count);
    const sizes = new Float32Array(count);
    const headings = new Float32Array(count);
    const homePositions = new Float32Array(count * 3);
    const breathParams = new Float32Array(count * 9);
    const hueSeeds = new Float32Array(count * 2);
    buildSchoolFormation(homePositions, count, length, height, depth);
    buildBreathParams(breathParams, count);
    buildHueSeeds(hueSeeds, count);
    sizes.fill(1.0); // Main school: uniform baseline size; pulse via aIntensity.
    headings.fill(0); // Main school glyphs face +X (school is laid out along X).

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute(
      "aIntensity",
      new THREE.BufferAttribute(intensities, 1),
    );
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aHeading", new THREE.BufferAttribute(headings, 1));

    // Custom shader: per-particle size pulse driven by aIntensity, plus
    // each sprite rendered as a velocity-aligned oval (≈ side-view fish
    // glyph). baseSize bumped so non-pulsed particles still read as ovals;
    // pulseSize reduced so peak (baseSize + pulseSize) stays roughly the
    // same as before — the wave-hit "fat" emphasis level is preserved.
    const baseSize = isMobile ? 4.0 : 5.5;
    const pulseSize = isMobile ? 4.3 : 5.8;
    const sizeUniform = { value: new THREE.Vector2(baseSize, pulseSize) };
    const scaleUniform = {
      value: renderer.domElement.height / 2,
    };
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uSize: sizeUniform,
        uScale: scaleUniform,
      },
      vertexShader: `
        attribute float aIntensity;
        attribute float aSize;
        attribute float aHeading;
        uniform vec2 uSize;
        uniform float uScale;
        varying vec3 vColor;
        varying float vIntensity;
        varying float vHeading;
        void main() {
          vColor = color;
          vIntensity = aIntensity;
          vHeading = aHeading;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          // aSize is a per-particle size scalar (1.0 = baseline). Used by
          // ambient fish to render with varied sizes; always 1.0 for the
          // main school (their pulse comes from aIntensity).
          float size = uSize.x * aSize + aIntensity * uSize.y;
          gl_PointSize = size * (uScale / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vIntensity;
        varying float vHeading;
        void main() {
          // Sprite-local coords in [-1, 1]. gl_PointCoord.y is flipped (top=0
          // in WebGL), so we negate Y to align with world-Y orientation.
          vec2 uv = (gl_PointCoord - vec2(0.5)) * 2.0;
          vec2 uvWorld = vec2(uv.x, -uv.y);
          // Rotate uv by -heading so the ellipse's long axis aligns with
          // the fish's swim direction.
          float c = cos(vHeading);
          float s = sin(vHeading);
          vec2 uvLocal = vec2(
            uvWorld.x * c + uvWorld.y * s,
            -uvWorld.x * s + uvWorld.y * c
          );
          // Fish-glyph: oval ~3× wider than tall along the heading direction.
          float ax = 1.0;
          float ay = 0.34;
          float d2 = (uvLocal.x * uvLocal.x) / (ax * ax) +
                     (uvLocal.y * uvLocal.y) / (ay * ay);
          if (d2 > 1.0) discard;
          float alpha = smoothstep(1.0, 0.45, d2);
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const tmpColor = new THREE.Color();

    // ── Ambient marine life ────────────────────────────────────────────
    // Background fish drifting across the scene. ~55% are organized into
    // small mini-schools (4–7 fish moving as one — sharing direction +
    // velocity, clustered tightly); the rest are solo wanderers. Real
    // ocean footage shows this exact mix: one focal school plus smaller
    // schools darting around it and lone fish meandering through.
    const ambientCount = isMobile ? 40 : 80;
    const ambientPositions = new Float32Array(ambientCount * 3);
    const ambientColors = new Float32Array(ambientCount * 3);
    const ambientIntensities = new Float32Array(ambientCount);
    const ambientSizes = new Float32Array(ambientCount);
    const ambientHeadings = new Float32Array(ambientCount);
    const ambientVelocities = new Float32Array(ambientCount * 3);

    const ambientGeometry = new THREE.BufferGeometry();
    ambientGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(ambientPositions, 3),
    );
    ambientGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(ambientColors, 3),
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
      "aHeading",
      new THREE.BufferAttribute(ambientHeadings, 1),
    );

    const ambientSizeUniform = {
      value: new THREE.Vector2(isMobile ? 2.4 : 3.2, 0),
    };
    const ambientMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uSize: ambientSizeUniform,
        uScale: scaleUniform,
      },
      vertexShader: material.vertexShader,
      fragmentShader: material.fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
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

      const i3 = i * 3;
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
      const heading = Math.atan2(vy, vx);

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

      // Group "species" base color so members of a school look related.
      const baseHue = 0.5 + (Math.random() - 0.5) * 0.1;
      const baseSat = 0.22 + Math.random() * 0.4;
      const baseLight = 0.46 + Math.random() * 0.22;

      const writeMember = (
        idx: number,
        offsetX: number,
        offsetY: number,
        offsetZ: number,
        sizeJitter: number,
        hueJitter: number,
        satJitter: number,
        lightJitter: number,
      ): void => {
        const m3 = idx * 3;
        ambientPositions[m3] = startX + offsetX;
        ambientPositions[m3 + 1] = startY + offsetY;
        ambientPositions[m3 + 2] = startZ + offsetZ;
        ambientVelocities[m3] = vx;
        ambientVelocities[m3 + 1] = vy;
        ambientVelocities[m3 + 2] = vz;
        ambientHeadings[idx] = heading;
        const sizeRoll = Math.random();
        const sizeBase = 0.4 + Math.pow(sizeRoll, 1.6) * 2.2;
        ambientSizes[idx] = sizeBase * sizeJitter;
        tmpColor.setHSL(
          baseHue + hueJitter,
          Math.min(1, Math.max(0, baseSat + satJitter)),
          Math.min(0.9, Math.max(0.2, baseLight + lightJitter)),
        );
        ambientColors[m3] = tmpColor.r;
        ambientColors[m3 + 1] = tmpColor.g;
        ambientColors[m3 + 2] = tmpColor.b;
      };

      // Place leader (or solo).
      writeMember(i, 0, 0, 0, 1.0, 0, 0, 0);

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
            (Math.random() - 0.5) * 0.04,
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.08,
          );
        }
      }
    };

    for (let i = 0; i < ambientCount; i++) spawnAmbient(i, true);
    ambientGeometry.attributes.position.needsUpdate = true;
    ambientGeometry.attributes.color.needsUpdate = true;
    ambientGeometry.attributes.aSize.needsUpdate = true;
    ambientGeometry.attributes.aHeading.needsUpdate = true;

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
    let consensusBroadcastFired = false;

    const t0 = performance.now();
    let raf = 0;
    let cancelled = false;
    let lastTime = -1;

    const renderFrame = (timeSec: number) => {
      const t = timeSec * SWIM_SPEED;
      // Time delta for frame-rate-independent ambient motion. Cap at 50ms
      // to avoid teleporting fish if the tab was backgrounded.
      const dt = lastTime < 0 ? 0 : Math.min(0.05, timeSec - lastTime);
      lastTime = timeSec;

      // Whole-body glide — kept tight around center so the school stays
      // visually anchored rather than swinging across the whole canvas.
      const fishCenterX = Math.sin(t * 0.13) * 45;
      const fishCenterY = Math.sin(t * 0.09 + 1.2) * 18;
      const fishYaw = Math.sin(t * 0.07) * 0.35;
      const cosY = Math.cos(fishYaw);
      const sinY = Math.sin(fishYaw);

      // Consensus phase + soft breathing pulse during the all-green phase.
      const consensus = consensusFactor(timeSec);
      const phaseT = (timeSec % CONSENSUS_CYCLE) / CONSENSUS_CYCLE;
      let consensusPulse = 0;
      if (phaseT >= PHASE_CONVERGE_END && phaseT < PHASE_CONSENSUS_END) {
        const localT =
          (phaseT - PHASE_CONVERGE_END) /
          (PHASE_CONSENSUS_END - PHASE_CONVERGE_END);
        const fade = Math.min(1, Math.min(localT * 4, (1 - localT) * 4));
        consensusPulse = (0.5 + 0.5 * Math.sin(timeSec * 4.0)) * fade;
      }

      // ── Wave scheduler — agent debate dynamics ──────────────────────
      // DIVERGE   : rapid, often concurrent waves from random directions
      //             with varying strength (many agents speaking, soft
      //             voices, conflicting opinions).
      // CONVERGE  : waves get more biased toward horizontal as opinions
      //             align; cadence slows; strength rises.
      // CONSENSUS : exactly one decisive horizontal broadcast (left→right)
      //             at full strength — the network's final answer.
      // RELEASE   : quiet trail-off, occasional soft echo.
      const inConsensus =
        phaseT >= PHASE_CONVERGE_END && phaseT < PHASE_CONSENSUS_END;
      const inConverge =
        phaseT >= PHASE_DIVERGE_END && phaseT < PHASE_CONVERGE_END;
      const inRelease = phaseT >= PHASE_CONSENSUS_END;

      // Reset the once-per-cycle broadcast flag at the start of each cycle.
      if (phaseT < 0.05) consensusBroadcastFired = false;

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
            let minProj = Infinity;
            let maxProj = -Infinity;
            for (let p = 0; p < count; p++) {
              const p3 = p * 3;
              const proj =
                homePositions[p3] * ndx +
                homePositions[p3 + 1] * ndy +
                homePositions[p3 + 2] * ndz;
              if (proj < minProj) minProj = proj;
              if (proj > maxProj) maxProj = proj;
            }
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

      // Fire the consensus broadcast exactly once when entering consensus.
      if (inConsensus && !consensusBroadcastFired) {
        // Clear noisy partial debate waves so the broadcast lands cleanly.
        for (let wi = 0; wi < waves.length; wi++) waves[wi].active = false;
        spawnWave(0, 1.0, 0); // Always horizontal left→right.
        consensusBroadcastFired = true;
        nextSpawn = timeSec + WAVE_DURATION + 0.6;
      } else if (timeSec >= nextSpawn && !inConsensus) {
        if (inConverge) {
          // Settling phase: bias toward horizontal, stronger voices,
          // slower cadence.
          const horizontalBias =
            (phaseT - PHASE_DIVERGE_END) /
            (PHASE_CONVERGE_END - PHASE_DIVERGE_END);
          const baseAngle = Math.random() < 0.5 ? 0 : Math.PI;
          const jitter = (Math.random() - 0.5) * Math.PI * (1 - horizontalBias);
          const angle = baseAngle + jitter;
          const strength = 0.7 + Math.random() * 0.3;
          spawnWave(angle, strength, (Math.random() - 0.5) * 0.2);
          nextSpawn = timeSec + 0.55 + Math.random() * 0.9;
        } else if (inRelease) {
          // Quiet trail-off: occasional dim wave.
          if (Math.random() < 0.6) {
            const angle = Math.random() * TAU;
            const strength = 0.4 + Math.random() * 0.2;
            spawnWave(angle, strength, (Math.random() - 0.5) * 0.3);
          }
          nextSpawn = timeSec + 0.9 + Math.random() * 1.0;
        } else {
          // Diverge — debate. Random angles + strong vertical occasionally.
          // Varying strength (0.45..0.95) → soft and loud voices mixing.
          let angle = Math.random() * TAU;
          if (Math.random() < 0.18) {
            const sign = Math.random() < 0.5 ? 1 : -1;
            angle = sign * (Math.PI / 2) + (Math.random() - 0.5) * 0.4;
          }
          const strength = 0.45 + Math.random() * 0.5;
          spawnWave(angle, strength, (Math.random() - 0.5) * 0.3);
          nextSpawn =
            timeSec +
            WAVE_INTERVAL_MIN +
            Math.random() * (WAVE_INTERVAL_MAX - WAVE_INTERVAL_MIN);
        }
      }

      for (let wi = 0; wi < waves.length; wi++) {
        if (waves[wi].active && timeSec - waves[wi].startTime > WAVE_DURATION) {
          waves[wi].active = false;
        }
      }

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const i9 = i * 9;
        const i2 = i * 2;

        const hx = homePositions[i3];
        const hy = homePositions[i3 + 1];
        const hz = homePositions[i3 + 2];

        // Per-particle breath orbit — staggered micro-motion.
        const breathX =
          Math.sin(timeSec * breathParams[i9] + breathParams[i9 + 3]) *
          breathParams[i9 + 6];
        const breathY =
          Math.sin(timeSec * breathParams[i9 + 1] + breathParams[i9 + 4]) *
          breathParams[i9 + 7];
        const breathZ =
          Math.sin(timeSec * breathParams[i9 + 2] + breathParams[i9 + 5]) *
          breathParams[i9 + 8];

        // Tail wiggle on Y — ramps from 0 at front body to 1 at tail tip.
        // Vertical motion reads more clearly than lateral wiggle on a
        // side-view fish at this camera angle.
        const tailT = Math.max(0, Math.min(1, -hx / halfLen));
        const wiggle = Math.sin(t * 4.5 + tailT * 6.0) * WIGGLE_AMP * tailT;

        const localX = hx + breathX;
        const localY = hy + breathY + wiggle;
        const localZ = hz + breathZ;

        // Yaw rotation around Y axis, then whole-body translation.
        const rotX = localX * cosY - localZ * sinY;
        const rotZ = localX * sinY + localZ * cosY;
        positions[i3] = rotX + fishCenterX;
        positions[i3 + 1] = localY + fishCenterY;
        positions[i3 + 2] = rotZ;

        // ── Color ──────────────────────────────────────────────────
        // Per-particle drifting hue (random palette during diverge phase).
        const baseHue = (hueSeeds[i2] + timeSec * hueSeeds[i2 + 1]) % 1.0;

        // Signal-wave intensity — DIRECTIONAL plane sweep across the school.
        // Asymmetric envelope: sharp Gaussian leading edge (particles ahead
        // of the wavefront pop quickly) + long exponential afterglow tail
        // (particles behind it fade slowly). Reads as a comet sweeping
        // through the school instead of a symmetric blob.
        let waveIntensity = 0;
        for (let wi = 0; wi < waves.length; wi++) {
          const wave = waves[wi];
          if (!wave.active) continue;
          const elapsed = timeSec - wave.startTime;
          const wavePos =
            wave.startProj + wave.spanProj * (elapsed / WAVE_DURATION);
          const proj = hx * wave.dirX + hy * wave.dirY + hz * wave.dirZ;
          const norm = (wavePos - proj) / waveWidth;
          // Asymmetric Gaussian: very sharp leading edge (norm < 0), wider
          // trailing tail (norm > 0) — gives a clean comet-head sweep.
          // Per-wave `strength` modulates loudness (debate has soft/loud
          // voices; consensus broadcast is full strength).
          const env =
            (norm >= 0
              ? Math.exp(-norm * norm * 0.6)
              : Math.exp(-norm * norm * 6)) * wave.strength;
          if (env > waveIntensity) waveIntensity = env;
        }

        // Pull hue toward green by both consensus and wave intensity.
        const greenPull = consensus > waveIntensity ? consensus : waveIntensity;
        const hue = baseHue * (1 - greenPull) + GREEN_HUE * greenPull;

        // Saturation: subdued when divergent, vivid under wave or consensus.
        const sat = 0.45 + 0.45 * greenPull;

        // Lightness: dim base + a measured wave bump. Capped at 0.78 so
        // overlapping wave-lit particles don't saturate to pure white via
        // additive blending — the size pulse carries the rest of the
        // emphasis.
        const light = Math.min(
          0.78,
          0.4 + waveIntensity * 0.32 + consensus * 0.1 + consensusPulse * 0.06,
        );

        tmpColor.setHSL(hue, sat, light);
        colors[i3] = tmpColor.r;
        colors[i3 + 1] = tmpColor.g;
        colors[i3 + 2] = tmpColor.b;

        // Size-pulse intensity drives the per-particle gl_PointSize bump in
        // the vertex shader. Wave dominates; consensus pulse contributes a
        // synchronized breathing pulse during the consensus hold phase.
        const pulse =
          waveIntensity > consensusPulse * 0.7
            ? waveIntensity
            : consensusPulse * 0.7;
        intensities[i] = pulse;
      }

      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      geometry.attributes.aIntensity.needsUpdate = true;

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
          ambientGeometry.attributes.color.needsUpdate = true;
          ambientGeometry.attributes.aSize.needsUpdate = true;
          ambientGeometry.attributes.aHeading.needsUpdate = true;
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
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      ambientGeometry.dispose();
      ambientMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    />
  );
}
