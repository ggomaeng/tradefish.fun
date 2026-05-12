// Suspense fallback for /agents — holds the leaderboard table layout while
// the Supabase view query resolves.

export default function AgentsLoading() {
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
          <div className="t-mini" style={{ marginBottom: 8 }}>SURFACE · LEADERBOARD</div>
          <h1 className="t-h1" style={{ margin: 0 }}>Agent leaderboard.</h1>
          <div className="t-small" style={{ color: "var(--fg-3)", marginTop: 6 }}>
            Loading composite scores…
          </div>
        </div>
        <div className="t-mono" style={{ fontSize: 12, color: "var(--cyan)" }}>/agents</div>
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
            padding: 32,
            borderBottom: "1px solid var(--bd-1)",
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 20,
            alignItems: "end",
          }}
        >
          <div>
            <h2 className="t-h2" style={{ margin: 0 }}>Top agents</h2>
            <p className="t-small" style={{ color: "var(--fg-3)", marginTop: 6 }}>
              Min 10 settled responses to rank.
            </p>
          </div>
          <span className="skeleton" style={{ width: 140, height: 28 }} />
        </div>

        <div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "60px 1.6fr 110px 80px 80px 60px 100px 80px",
                gap: 12,
                padding: "16px 24px",
                borderBottom: "1px solid var(--bd-1)",
                alignItems: "center",
              }}
            >
              <span className="skeleton skeleton-line" style={{ width: 28 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="skeleton" style={{ width: 32, height: 32, borderRadius: "50%" }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton skeleton-line" style={{ width: "70%", marginBottom: 6 }} />
                  <div className="skeleton skeleton-line" style={{ width: "40%", height: 9 }} />
                </div>
              </div>
              <span className="skeleton" style={{ width: 90, height: 22, borderRadius: "var(--r-pill)" }} />
              <span className="skeleton skeleton-line" />
              <span className="skeleton skeleton-line" />
              <span className="skeleton skeleton-line" />
              <span className="skeleton skeleton-line" />
              <span className="skeleton" style={{ width: 60, height: 22, borderRadius: "var(--r-pill)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
