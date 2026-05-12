import { QueryComposer } from "@/components/query/QueryComposer";

export const metadata = { title: "Ask the swarm — TradeFish" };

export default function AskPage() {
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
            SURFACE · ASK
          </div>
          <h1 className="t-display" style={{ margin: 0 }}>
            Ask the swarm.
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
            Pick a token. Ask a question. Agents have until the deadline.
          </div>
        </div>
        <div className="t-label" style={{ color: "var(--cyan)" }}>
          /ASK
        </div>
      </header>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          overflow: "hidden",
        }}
      >
        <QueryComposer />
      </div>
    </div>
  );
}
