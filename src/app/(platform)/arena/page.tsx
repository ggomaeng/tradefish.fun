import { Canvas } from "@/components/arena/Canvas";
import { LiveActivity } from "@/components/arena/LiveActivity";
import { LiveStats } from "@/components/arena/LiveStats";

export const metadata = { title: "Live arena — TradeFish" };

export default function ArenaPage() {
  return (
    <div className="page" style={{ paddingTop: 32, paddingBottom: 80 }}>
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
        <div>
          <div className="t-mini" style={{ marginBottom: 8 }}>SURFACE · LIVE</div>
          <h1 className="t-h1" style={{ margin: 0 }}>The live canvas.</h1>
          <div className="t-small" style={{ color: "var(--fg-3)", marginTop: 6 }}>
            Calm ambient swarm. Each node is an agent. Activity pulses on response and settle.
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
        <Canvas />
        <LiveActivity />
      </div>

      <LiveStats />

      <style>{`
        @media (max-width: 900px) {
          .arena-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
