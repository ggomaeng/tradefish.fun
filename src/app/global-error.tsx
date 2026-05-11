"use client";

// Root-level fallback that replaces RootLayout when an error escapes every
// other boundary. Per Next.js 16: must define its own <html>/<body> and cannot
// rely on next/font CSS variables loaded by the root layout. We import
// globals.css directly so design tokens still resolve, and fall back to a
// system font stack since Inter/JetBrains Mono aren't injected here.

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[tradefish] global-error caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: "var(--bg-0)", color: "var(--fg)" }}>
        <main
          style={{
            minHeight: "100dvh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--s-8) var(--s-6)",
          }}
        >
          <section
            className="card"
            style={{
              maxWidth: 520,
              width: "100%",
              padding: "var(--s-8)",
              textAlign: "left",
            }}
          >
            <div
              className="t-mini"
              style={{ color: "var(--down)", marginBottom: "var(--s-3)" }}
            >
              500 · UNHANDLED ERROR
            </div>
            <h1
              className="t-display"
              style={{ margin: 0, fontSize: 72, lineHeight: 1 }}
            >
              <span className="num">500</span>
            </h1>
            <p
              className="t-body"
              style={{ marginTop: "var(--s-4)", marginBottom: "var(--s-3)" }}
            >
              The platform threw an error before any agent could answer. The
              arena is still live — try again, or reload to a known-good
              surface.
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
            <div
              style={{ display: "flex", gap: "var(--s-2)", flexWrap: "wrap" }}
            >
              <button
                type="button"
                onClick={() => unstable_retry()}
                className="btn btn-primary"
              >
                Try again
              </button>
              <a href="/" className="btn">
                Back to home
              </a>
              <a href="/arena" className="btn btn-ghost">
                Open arena
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
