// Suspense fallback for /claim/[token]. The page itself awaits params then
// renders ClaimClient (which has its own internal phase machine), so this
// fallback only paints during the initial server transition. Holds the
// stage + stepper + form layout so it never shifts when the client mounts.

export default function ClaimLoading() {
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
          <div className="t-mini" style={{ marginBottom: 8 }}>SURFACE · CLAIM</div>
          <h1 className="t-h1" style={{ margin: 0 }}>Claim agent.</h1>
          <div className="t-small" style={{ color: "var(--fg-3)", marginTop: 6 }}>
            Loading claim flow…
          </div>
        </div>
        <div className="t-mono" style={{ fontSize: 12, color: "var(--cyan)" }}>/claim/…</div>
      </header>

      <div
        className="claim-grid"
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--bd-1)",
          borderRadius: "var(--r-4)",
          overflow: "hidden",
          boxShadow: "0 1px 0 var(--bd-1) inset, 0 24px 60px rgba(0,0,0,0.45)",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          minHeight: 640,
        }}
      >
        <div
          className="claim-stage"
          style={{
            background: "radial-gradient(ellipse at center, rgba(153,69,255,0.12), transparent 60%), var(--bg-0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 48,
          }}
        >
          <span className="skeleton" style={{ width: 320, height: 320, borderRadius: "50%" }} />
        </div>

        <div
          style={{
            padding: "64px 48px",
            display: "flex",
            flexDirection: "column",
            background: "var(--bg-1)",
            borderLeft: "1px solid var(--bd-1)",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, marginBottom: 36 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <span
                key={i}
                className="skeleton skeleton-line"
                style={{ height: 22, borderRadius: 0 }}
              />
            ))}
          </div>
          <div className="skeleton skeleton-line" style={{ width: 180, marginBottom: 16 }} />
          <div className="skeleton" style={{ width: "70%", height: 32, marginBottom: 14 }} />
          <div className="skeleton skeleton-line" style={{ width: "100%", marginBottom: 8 }} />
          <div className="skeleton skeleton-line" style={{ width: "85%", marginBottom: 28 }} />
          <div className="skeleton skeleton-block" style={{ height: 80, marginBottom: 24 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 24 }}>
            <div className="skeleton skeleton-block" style={{ height: 70 }} />
            <div className="skeleton skeleton-block" style={{ height: 70 }} />
          </div>
          <div className="skeleton" style={{ height: 44, width: "100%" }} />
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .claim-grid { grid-template-columns: 1fr !important; }
          .claim-stage { display: none !important; }
        }
      `}</style>
    </div>
  );
}
