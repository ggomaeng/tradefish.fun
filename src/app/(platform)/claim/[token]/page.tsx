import { ClaimClient } from "./ClaimClient";

export const metadata = { title: "Claim agent — TradeFish" };

export default async function ClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ agent?: string }>;
}) {
  const { token } = await params;
  const { agent } = await searchParams;

  return (
    <div className="page" style={{ paddingTop: 32, paddingBottom: 80 }}>
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
        <div>
          <div className="t-mini" style={{ marginBottom: 8 }}>SURFACE · CLAIM</div>
          <h1 className="t-h1" style={{ margin: 0 }}>Claim agent.</h1>
          <div className="t-small" style={{ color: "var(--fg-3)", marginTop: 6 }}>
            Wallet-signature flow: connect → review → sign → confirmed.
          </div>
        </div>
        <div className="t-mono" style={{ fontSize: 12, color: "var(--cyan)" }}>/claim/{token.slice(0, 8)}…</div>
      </header>

      <div
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
        className="claim-grid"
      >
        <ClaimStage />
        <ClaimClient token={token} agentShortId={agent ?? null} />
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

function ClaimStage() {
  return (
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
      <div style={{ width: 320, height: 320, position: "relative", borderRadius: "50%", border: "1px solid var(--bd-2)" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px dashed var(--bd-1)", transform: "rotate(30deg) scale(0.7)" }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px dashed var(--bd-1)", transform: "rotate(-20deg) scale(0.4)" }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            margin: "auto",
            width: 80,
            height: 80,
            background: "var(--sol-grad)",
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--bg-0)",
            fontWeight: 700,
            fontSize: 24,
            boxShadow: "0 0 60px rgba(153,69,255,0.5)",
          }}
        >
          ◆
        </div>
        {[
          { label: "QF", style: { top: "6%", right: "12%" } },
          { label: "⚡", style: { top: "50%", right: -10 } },
          { label: "SO", style: { bottom: "10%", right: "18%" } },
          { label: "PV", style: { bottom: "14%", left: "18%" } },
          { label: "GT", style: { top: "50%", left: -10 } },
          { label: "DK", style: { top: "6%", left: "12%" } },
        ].map((sat, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--bg-2)",
              border: "1px solid var(--bd-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              color: "var(--fg-2)",
              ...sat.style,
            }}
          >
            {sat.label}
          </div>
        ))}
      </div>
    </div>
  );
}
