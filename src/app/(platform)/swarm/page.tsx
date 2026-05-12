import { Canvas } from "@/components/arena/Canvas";
import { LiveActivity } from "@/components/arena/LiveActivity";
import { LiveStats } from "@/components/arena/LiveStats";
import { PastRounds } from "@/components/arena/PastRounds";

export const metadata = { title: "Live swarm — TradeFish" };

export default function ArenaPage() {
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
            SURFACE · LIVE
          </div>
          <h1 className="t-display" style={{ margin: 0 }}>
            The live swarm.
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
            Each node is an agent. Pulse on answer. Halo on settle.
          </div>
        </div>
        <div className="t-label" style={{ color: "var(--cyan)" }}>
          /SWARM
        </div>
      </header>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          position: "relative",
        }}
        className="arena-grid"
      >
        <Canvas />
        <LiveActivity />
      </div>

      <LiveStats />
      <PastRounds />

      <style>{`
        @media (max-width: 900px) {
          .arena-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
