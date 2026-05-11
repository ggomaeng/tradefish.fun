// Suspense fallback for /agents/[id] — holds the agent dashboard layout
// (hero row, 4-stat strip, body grid) while the Supabase queries resolve.

export default function AgentDetailLoading() {
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
          <div className="t-mini" style={{ marginBottom: 8 }}>SURFACE · AGENT</div>
          <h1 className="t-h1" style={{ margin: 0 }}>Agent dashboard.</h1>
          <div className="t-small" style={{ color: "var(--fg-3)", marginTop: 6 }}>
            Loading agent record + settled stats…
          </div>
        </div>
        <div className="t-mono" style={{ fontSize: 12, color: "var(--cyan)" }}>/agents/…</div>
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
            padding: "40px 32px 28px",
            borderBottom: "1px solid var(--bd-1)",
            display: "grid",
            gridTemplateColumns: "80px 1fr auto",
            gap: 24,
            alignItems: "center",
          }}
        >
          <span className="skeleton" style={{ width: 80, height: 80, borderRadius: 16 }} />
          <div>
            <div className="skeleton" style={{ width: "40%", height: 32, marginBottom: 10 }} />
            <div className="skeleton skeleton-line" style={{ width: "60%" }} />
          </div>
          <span className="skeleton" style={{ width: 120, height: 32 }} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            borderBottom: "1px solid var(--bd-1)",
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                padding: "24px 32px",
                borderRight: i < 3 ? "1px solid var(--bd-1)" : "none",
              }}
            >
              <div className="t-mini" style={{ marginBottom: 8 }}>—</div>
              <div className="skeleton" style={{ width: "60%", height: 28 }} />
            </div>
          ))}
        </div>

        <div
          className="agent-body"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 360px",
            minHeight: 420,
          }}
        >
          <div style={{ padding: 32 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>Performance by window</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {(["1h", "4h", "24h"] as const).map((w) => (
                <div key={w} className="card">
                  <div className="t-mini">{w.toUpperCase()} window</div>
                  <div className="skeleton" style={{ width: "55%", height: 24, marginTop: 8 }} />
                  <div className="skeleton skeleton-line" style={{ width: "70%", marginTop: 10 }} />
                  <div className="skeleton skeleton-line" style={{ width: "50%", marginTop: 6 }} />
                </div>
              ))}
            </div>
          </div>
          <aside
            style={{
              background: "var(--bg-1)",
              borderLeft: "1px solid var(--bd-1)",
              padding: 28,
              display: "flex",
              flexDirection: "column",
              gap: 22,
            }}
          >
            <div>
              <div className="t-mini" style={{ marginBottom: 12 }}>Onboarding</div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="skeleton"
                  style={{ height: 36, marginBottom: 8 }}
                />
              ))}
            </div>
            <div>
              <div className="t-mini" style={{ marginBottom: 12 }}>Endpoint</div>
              <div className="skeleton skeleton-block" style={{ height: 60 }} />
            </div>
          </aside>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .agent-body { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
