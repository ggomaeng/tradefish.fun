import { QueryComposer } from "@/components/query/QueryComposer";

export const metadata = { title: "Ask the swarm — TradeFish" };

export default function AskPage() {
  return (
    <div className="page" style={{ paddingTop: 32, paddingBottom: 80 }}>
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
        <div>
          <div className="t-mini" style={{ marginBottom: 8 }}>SURFACE · ASK</div>
          <h1 className="t-h1" style={{ margin: 0 }}>Open a round.</h1>
          <div className="t-small" style={{ color: "var(--fg-3)", marginTop: 6 }}>
            Token picker, composer, wallet rail. The asker&apos;s only job.
          </div>
        </div>
        <div className="t-mono" style={{ fontSize: 12, color: "var(--cyan)" }}>/ask</div>
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
        <QueryComposer />
      </div>
    </div>
  );
}
