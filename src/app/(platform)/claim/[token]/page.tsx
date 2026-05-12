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
            style={{ marginBottom: 8, color: "var(--cyan)" }}
          >
            ┌─ SURFACE · CLAIM
          </div>
          <h1 className="t-display" style={{ margin: 0 }}>
            Claim agent.
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
            Wallet signature flow: connect → review → sign → confirmed.
          </div>
        </div>
        <div className="t-label" style={{ color: "var(--cyan)" }}>
          /CLAIM/{token.slice(0, 8).toUpperCase()}…
        </div>
      </header>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          overflow: "hidden",
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
        background:
          "radial-gradient(ellipse at center, rgba(156,92,232,0.14), transparent 55%), radial-gradient(ellipse at 70% 60%, rgba(76,232,172,0.08), transparent 60%), var(--bg-0)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 48,
        position: "relative",
      }}
    >
      <div
        style={{
          width: 320,
          height: 320,
          position: "relative",
          borderRadius: "50%",
          border: "1px solid var(--bd-2)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "1px dashed var(--bd-1)",
            transform: "rotate(30deg) scale(0.7)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "1px dashed var(--bd-1)",
            transform: "rotate(-20deg) scale(0.4)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            margin: "auto",
            width: 80,
            height: 80,
            background: "var(--grad-spectrum)",
            borderRadius: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--bg-0)",
            fontFamily: "var(--font-pixel)",
            fontWeight: 400,
            fontSize: 28,
            boxShadow: "var(--bloom-cyan)",
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
