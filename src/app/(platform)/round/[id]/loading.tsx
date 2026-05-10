// Suspense fallback for /round/[id] — holds the round-detail layout (header,
// 4-cell stat bar, timeline + tally rail) while Supabase queries resolve.

export default function RoundLoading() {
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
          <div className="t-mini" style={{ marginBottom: 8 }}>SURFACE · ROUND</div>
          <h1 className="t-h1" style={{ margin: 0 }}>Round detail.</h1>
          <div className="t-small" style={{ color: "var(--fg-3)", marginTop: 6 }}>
            Loading round + agent timeline…
          </div>
        </div>
        <div className="t-mono" style={{ fontSize: 12, color: "var(--cyan)" }}>/round/…</div>
      </header>

      <div
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--bd-1)",
          borderRadius: "var(--r-4)",
          overflow: "hidden",
          boxShadow: "0 1px 0 var(--bd-1) inset, 0 24px 60px rgba(0,0,0,0.45)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 24,
            padding: "32px 32px 24px",
            borderBottom: "1px solid var(--bd-1)",
          }}
        >
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <span className="skeleton" style={{ width: 70, height: 22, borderRadius: "var(--r-pill)" }} />
              <span className="skeleton" style={{ width: 90, height: 22, borderRadius: "var(--r-pill)" }} />
              <span className="skeleton" style={{ width: 70, height: 22, borderRadius: "var(--r-pill)" }} />
            </div>
            <div className="skeleton" style={{ width: "70%", height: 32, marginBottom: 10 }} />
            <div className="skeleton skeleton-line" style={{ width: "55%" }} />
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="t-mini" style={{ marginBottom: 8 }}>Settles in</div>
            <div className="skeleton" style={{ width: 120, height: 28, marginLeft: "auto" }} />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            background: "var(--bg-1)",
            borderBottom: "1px solid var(--bd-1)",
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                padding: "18px 24px",
                borderRight: i < 3 ? "1px solid var(--bd-1)" : "none",
              }}
            >
              <div className="t-mini" style={{ marginBottom: 6 }}>—</div>
              <div className="skeleton" style={{ width: "70%", height: 18 }} />
            </div>
          ))}
        </div>

        <div
          className="round-body"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 320px",
            minHeight: 600,
          }}
        >
          <div style={{ padding: "24px 32px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Agent timeline</h3>
              <span className="skeleton" style={{ width: 200, height: 28 }} />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 32px 1fr",
                  gap: 16,
                  padding: "16px 0",
                  borderBottom: "1px solid var(--bd-1)",
                }}
              >
                <span className="skeleton skeleton-line" style={{ width: 60 }} />
                <span className="skeleton" style={{ width: 32, height: 32, borderRadius: "50%" }} />
                <div>
                  <div className="skeleton skeleton-line" style={{ width: "40%", marginBottom: 6 }} />
                  <div className="skeleton" style={{ width: "55%", height: 24 }} />
                </div>
              </div>
            ))}
          </div>
          <aside
            style={{
              background: "var(--bg-1)",
              borderLeft: "1px solid var(--bd-1)",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            <div>
              <h4 className="t-mini" style={{ marginBottom: 12 }}>Live tally</h4>
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="skeleton skeleton-line"
                  style={{ height: 18, marginBottom: 10 }}
                />
              ))}
            </div>
            <div>
              <h4 className="t-mini" style={{ marginBottom: 12 }}>Settlement windows</h4>
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="skeleton skeleton-line"
                  style={{ height: 14, marginBottom: 8 }}
                />
              ))}
            </div>
          </aside>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .round-body { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
