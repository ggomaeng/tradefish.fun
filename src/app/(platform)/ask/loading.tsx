// Suspense fallback for /ask. The composer itself is a client component, so
// this only fires on the initial route transition. We hold the layout so the
// header + composer card never shifts.

export default function AskLoading() {
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
          <div className="t-mini" style={{ marginBottom: 8 }}>SURFACE · ASK</div>
          <h1 className="t-h1" style={{ margin: 0 }}>Open a round.</h1>
          <div className="t-small" style={{ color: "var(--fg-3)", marginTop: 6 }}>
            Booting the composer…
          </div>
        </div>
        <div className="t-mono" style={{ fontSize: 12, color: "var(--cyan)" }}>/ask</div>
      </header>

      <div
        className="ask-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          minHeight: 640,
          background: "var(--bg-1)",
          border: "1px solid var(--bd-1)",
          borderRadius: "var(--r-4)",
          overflow: "hidden",
          boxShadow: "0 1px 0 var(--bd-1) inset, 0 24px 60px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ padding: "64px 48px" }}>
          <div className="skeleton skeleton-line" style={{ width: 120, marginBottom: 20 }} />
          <div className="skeleton" style={{ width: "70%", height: 40, marginBottom: 12 }} />
          <div className="skeleton skeleton-line" style={{ width: "85%", marginBottom: 36 }} />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
              marginBottom: 28,
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 14,
                  background: "var(--bg-2)",
                  border: "1px solid var(--bd-1)",
                  borderRadius: "var(--r-3)",
                }}
              >
                <span className="skeleton" style={{ width: 32, height: 32, borderRadius: "50%" }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton skeleton-line" style={{ width: "60%", marginBottom: 6 }} />
                  <div className="skeleton skeleton-line" style={{ width: "80%", height: 9 }} />
                </div>
              </div>
            ))}
          </div>

          <div className="skeleton skeleton-block" style={{ width: "100%", height: 92 }} />
        </div>
        <aside
          style={{
            background: "var(--bg-1)",
            borderLeft: "1px solid var(--bd-1)",
            padding: "32px 28px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div className="card" style={{ padding: 20 }}>
            <div className="t-mini" style={{ marginBottom: 8 }}>Balance</div>
            <div className="skeleton" style={{ width: "60%", height: 32, marginBottom: 12 }} />
            <div className="skeleton skeleton-line" style={{ width: "40%" }} />
          </div>
          <div>
            <div className="t-mini" style={{ marginBottom: 10 }}>How scoring works</div>
            <div className="skeleton skeleton-line" style={{ width: "100%", marginBottom: 6 }} />
            <div className="skeleton skeleton-line" style={{ width: "85%", marginBottom: 6 }} />
            <div className="skeleton skeleton-line" style={{ width: "70%" }} />
          </div>
        </aside>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .ask-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
