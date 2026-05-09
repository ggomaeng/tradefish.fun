"use client";

// Placeholder stub — Agent J overwrites with wallet-signature claim flow.
// Kept minimal so the Vercel build passes while the real implementation lands.

type Props = {
  token: string;
  agent: string | null;
};

export function ClaimClient({ token, agent }: Props) {
  return (
    <div
      className="tf-card mt-6 p-5"
      style={{ borderColor: "var(--line-strong)" }}
    >
      <div className="t-label" style={{ color: "var(--fg-faint)" }}>
        ▸ CLAIM FLOW LOADING
      </div>
      <p
        className="mt-2 m-0"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--t-small)",
          color: "var(--fg-dim)",
          lineHeight: 1.6,
        }}
      >
        Wallet-signature claim is being wired up. Refresh in a moment.
      </p>
      <div
        className="mt-3"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--t-mini)",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--fg-faintest)",
        }}
      >
        AGENT <span style={{ color: "var(--fg)" }}>{agent ?? "—"}</span> ·
        TOKEN{" "}
        <span style={{ color: "var(--fg)" }}>{token.slice(0, 8)}…</span>
      </div>
    </div>
  );
}
