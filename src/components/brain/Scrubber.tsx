"use client";

/**
 * Scrubber — time-lapse control for /brain.
 *
 * Range: earliest node's created_at → now().
 * Dragging fires `onAtChange(isoString)`.
 * Play button auto-advances 1 day/sec.
 */

import { useCallback, useEffect, useRef, useState } from "react";

interface ScrubberProps {
  minAt: string | null;  // ISO from earliest node created_at
  atMs: number;          // current scrubber position (ms)
  onAtChange: (atMs: number) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function Scrubber({ minAt, atMs, onAtChange }: ScrubberProps) {
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep a mutable ref so the setInterval callback always reads the latest atMs
  // without needing to be recreated each tick (avoids stale-closure bug where
  // every tick jumps DAY_MS from the original play-start position instead of
  // from the most-recently-emitted position).
  const atMsRef = useRef(atMs);
  atMsRef.current = atMs;

  // Stable "now" captured on mount via useState initializer (not re-evaluated
  // on re-render). The range ceiling drifts by at most the session length,
  // which is acceptable for a time-lapse scrubber.
  const [nowMs] = useState(() => Date.now());

  const minMs = minAt ? new Date(minAt).getTime() : nowMs - 7 * DAY_MS;
  const rangeMs = Math.max(1, nowMs - minMs);

  const fraction = Math.min(1, Math.max(0, (atMs - minMs) / rangeMs));
  const pct = fraction * 100;
  const isLive = atMs >= nowMs - 60_000; // within 1 min of now = live

  // ── Play/pause ──────────────────────────────────────────────────────────────
  const stopPlay = useCallback(() => {
    setPlaying(false);
    if (playRef.current) {
      clearInterval(playRef.current);
      playRef.current = null;
    }
  }, []);

  const startPlay = useCallback(() => {
    setPlaying(true);
    playRef.current = setInterval(() => {
      // Read latest position via ref — avoids stale closure
      const nextMs = Math.min(nowMs, atMsRef.current + DAY_MS);
      onAtChange(nextMs);
      if (nextMs >= nowMs) {
        stopPlay();
      }
    }, 1000);
  }, [nowMs, onAtChange, stopPlay]);

  // Auto-stop when playback reaches live — handled inside the interval callback.
  // Cleanup on unmount
  useEffect(() => () => stopPlay(), [stopPlay]);

  const togglePlay = () => {
    if (playing) {
      stopPlay();
    } else {
      // If at live, rewind to start first
      if (isLive) onAtChange(minMs);
      startPlay();
    }
  };

  // ── Drag-to-scrub ───────────────────────────────────────────────────────────
  const trackRef = useRef<HTMLDivElement>(null);

  const seekToClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const target = minMs + f * rangeMs;
      onAtChange(target);
      // Stop play if user scrubs manually
      if (playing) stopPlay();
    },
    [minMs, rangeMs, onAtChange, playing, stopPlay]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      seekToClientX(e.clientX);
      const onMove = (ev: MouseEvent) => seekToClientX(ev.clientX);
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [seekToClientX]
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches[0]) seekToClientX(e.touches[0].clientX);
    },
    [seekToClientX]
  );

  // ── Label ───────────────────────────────────────────────────────────────────
  const labelAt = isLive
    ? "live"
    : new Date(atMs).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });

  const labelMin = minAt
    ? new Date(minMs).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })
    : "–7d";

  return (
    <div style={wrapStyle}>
      <span style={labelStyle}>{labelMin}</span>

      {/* Track */}
      <div
        ref={trackRef}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        style={trackStyle}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Timeline scrubber"
      >
        {/* Fill */}
        <div style={{ ...fillStyle, width: `${pct}%` }} />
        {/* Thumb */}
        <div
          style={{
            ...thumbStyle,
            left: `calc(${pct}% - 6px)`,
            background: isLive ? "var(--up)" : "var(--cyan)",
          }}
        />
      </div>

      <span style={{ ...labelStyle, color: isLive ? "var(--up)" : "var(--fg-3)" }}>
        {labelAt}
      </span>

      <button
        onClick={togglePlay}
        style={playBtnStyle}
        aria-label={playing ? "Pause time-lapse" : "Play time-lapse"}
      >
        {playing ? "⏸" : "▷"}{" "}
        <span style={{ fontSize: 11 }}>{playing ? "pause" : "play time-lapse"}</span>
      </button>

      {isLive && !playing && (
        <span className="chip chip-live" style={{ marginLeft: 4 }}>
          <span className="dot" />
          LIVE
        </span>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const wrapStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "12px 20px",
  borderTop: "1px solid var(--bd-1)",
  background: "var(--bg-1)",
  flexShrink: 0,
};

const trackStyle: React.CSSProperties = {
  flex: 1,
  height: 4,
  background: "var(--bg-3)",
  borderRadius: "var(--r-1)",
  position: "relative",
  cursor: "pointer",
  userSelect: "none",
};

const fillStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  bottom: 0,
  background: "var(--cyan)",
  borderRadius: "var(--r-1)",
  transition: "width 300ms ease",
};

const thumbStyle: React.CSSProperties = {
  position: "absolute",
  top: -4,
  width: 12,
  height: 12,
  borderRadius: "50%",
  cursor: "grab",
  boxShadow: "0 0 0 2px rgba(0,0,0,0.6)",
  transition: "left 300ms ease",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--fg-3)",
  fontFamily: "var(--font-mono)",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const playBtnStyle: React.CSSProperties = {
  background: "var(--bg-3)",
  border: "1px solid var(--bd-2)",
  borderRadius: "var(--r-2)",
  color: "var(--fg-2)",
  fontSize: 14,
  padding: "4px 12px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 4,
  flexShrink: 0,
  whiteSpace: "nowrap",
};
