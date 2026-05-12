"use client";

// Shared route-level error surface. Used by every (platform)/<route>/error.tsx.
// Keeps the platform header from PlatformLayout (Next.js 16 error boundaries
// preserve parent layouts) and renders an on-brand card with a retry CTA.
//
// Tokens only — no raw colors, no novel font sizes. Mirrors the not-found.tsx
// + global-error.tsx voice from tick 32.

import Link from "next/link";
import { useEffect } from "react";

export type RouteErrorProps = {
  surfaceLabel: string; // e.g. "SWARM", "LEADERBOARD"
  routePath: string; // e.g. "/swarm"
  title: string; // e.g. "The swarm hit an error."
  body: string; // 1-2 sentence on-brand explanation
  error: Error & { digest?: string };
  retry: () => void;
  primaryHref?: { href: string; label: string };
};

export function RouteError({
  surfaceLabel,
  routePath,
  title,
  body,
  error,
  retry,
  primaryHref,
}: RouteErrorProps) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(`[tradefish] ${routePath} error:`, error);
  }, [error, routePath]);

  return (
    <div className="page" style={{ paddingTop: 32, paddingBottom: 80 }}>
      <header
        style={{
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            className="t-label"
            style={{ marginBottom: 8, color: "var(--magenta)" }}
          >
            ┌─ SURFACE · {surfaceLabel} · ERROR
          </div>
          <h1 className="t-display" style={{ margin: 0 }}>
            {title}
          </h1>
          <div
            className="t-small"
            style={{
              color: "var(--fg-faint)",
              marginTop: 8,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.04em",
            }}
          >
            The platform caught it before it crashed the page. Retry, or hop to
            a known-good surface.
          </div>
        </div>
        <div className="t-label" style={{ color: "var(--cyan)" }}>
          {routePath.toUpperCase()}
        </div>
      </header>

      <section
        className="card fade-up"
        style={{
          padding: "var(--s-8)",
          maxWidth: 640,
        }}
      >
        <p className="t-body" style={{ margin: 0, marginBottom: "var(--s-4)" }}>
          {body}
        </p>

        {error?.digest ? (
          <div
            className="t-mini t-mono"
            style={{
              color: "var(--fg-3)",
              marginBottom: "var(--s-6)",
              textTransform: "none",
              letterSpacing: 0,
            }}
          >
            digest: {error.digest}
          </div>
        ) : (
          <div style={{ marginBottom: "var(--s-6)" }} />
        )}

        <div style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => retry()}
            className="btn btn-primary"
          >
            Try again
          </button>
          {primaryHref && (
            <Link href={primaryHref.href} className="btn">
              {primaryHref.label}
            </Link>
          )}
          <Link href="/swarm" className="btn btn-ghost">
            Open swarm
          </Link>
        </div>
      </section>
    </div>
  );
}
