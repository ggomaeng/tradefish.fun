// Route-level Suspense fallback for /arena.
// Holds the canvas + activity-rail layout so the page never shifts when the
// real Realtime swarm hooks attach.

export default function ArenaLoading() {
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
          <div className="t-mini" style={{ marginBottom: 8 }}>SURFACE · LIVE</div>
          <h1 className="t-h1" style={{ margin: 0 }}>The live canvas.</h1>
          <div className="t-small" style={{ color: "var(--fg-3)", marginTop: 6 }}>
            Booting the swarm — connecting to Supabase Realtime…
          </div>
        </div>
        <div className="t-mono" style={{ fontSize: 12, color: "var(--cyan)" }}>/arena</div>
      </header>

      <div
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--bd-1)",
          borderRadius: "var(--r-4)",
          overflow: "hidden",
          boxShadow: "0 1px 0 var(--bd-1) inset, 0 24px 60px rgba(0,0,0,0.45)",
          display: "grid",
          gridTemplateColumns: "1fr 320px",
        }}
        className="arena-grid"
      >
        {/* Canvas placeholder */}
        <div style={{ minHeight: 540, padding: 24, position: "relative" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <span className="skeleton" style={{ width: 180, height: 22, borderRadius: "var(--r-pill)" }} />
            <span className="skeleton" style={{ width: 90, height: 22, borderRadius: "var(--r-pill)" }} />
          </div>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
              width: "min(420px, 80%)",
            }}
          >
            <div className="skeleton skeleton-line" style={{ width: 140, height: 10, margin: "0 auto var(--s-3)" }} />
            <div className="skeleton" style={{ width: "100%", height: 44, marginBottom: "var(--s-3)" }} />
            <div className="skeleton" style={{ width: "70%", height: 20, margin: "0 auto" }} />
          </div>
        </div>

        {/* Activity rail placeholder */}
        <aside
          style={{
            background: "var(--bg-1)",
            borderLeft: "1px solid var(--bd-1)",
            display: "flex",
            flexDirection: "column",
            minHeight: 540,
          }}
        >
          <div
            style={{
              padding: 16,
              borderBottom: "1px solid var(--bd-1)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h4 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Activity feed</h4>
            <span className="chip"><span className="dot" style={{ width: 6, height: 6, borderRadius: 999, background: "var(--fg-3)", display: "inline-block", marginRight: 6 }} />SYNC</span>
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--bd-1)",
                display: "grid",
                gridTemplateColumns: "28px 1fr",
                gap: 10,
              }}
            >
              <div className="skeleton" style={{ width: 28, height: 28, borderRadius: "50%" }} />
              <div>
                <div className="skeleton skeleton-line" style={{ width: "60%", marginBottom: 6 }} />
                <div className="skeleton skeleton-line" style={{ width: "40%", height: 9 }} />
              </div>
            </div>
          ))}
        </aside>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .arena-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
