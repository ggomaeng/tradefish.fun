"use client";

import { useState } from "react";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "already" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "submitting") return;
    setState("submitting");
    setErrMsg(null);
    try {
      const utm = readUtm();
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "landing", utm }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.error ?? "submit_failed");
      setState(json.already ? "already" : "success");
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "submit_failed");
      setState("error");
    }
  }

  if (state === "success" || state === "already") {
    return (
      <div style={{ maxWidth: 520 }}>
        <div
          style={{
            background: "var(--bg-1)",
            border: "1px solid var(--up-bd)",
            borderRadius: "var(--r-3)",
            padding: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span className="chip chip-up">✓ {state === "already" ? "ALREADY ON THE LIST" : "YOU'RE IN"}</span>
          </div>
          <div style={{ color: "var(--fg)", fontSize: 15 }}>
            {state === "already"
              ? "You're already on the waitlist. Your free launch credits are reserved."
              : "Welcome to the swarm. We'll email you when it opens."}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--fg-3)" }}>
            Follow{" "}
            <a href="https://x.com/tradefish_fun" target="_blank" rel="noreferrer" style={{ color: "var(--cyan)" }}>
              @tradefish_fun
            </a>{" "}
            for launch updates.
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 520 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          background: "var(--bg-2)",
          border: "1px solid var(--bd-2)",
          borderRadius: "var(--r-3)",
          padding: 4,
          transition: "border-color 120ms",
        }}
      >
        <input
          type="email"
          required
          autoComplete="email"
          spellCheck={false}
          placeholder="you@somewhere.fun"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            flex: 1,
            background: "transparent",
            border: 0,
            outline: "none",
            color: "var(--fg)",
            fontSize: 14,
            padding: "10px 14px",
            fontFamily: "var(--font-sans)",
          }}
        />
        <button
          type="submit"
          disabled={state === "submitting"}
          className="btn btn-primary"
          style={{ padding: "9px 16px" }}
        >
          {state === "submitting" ? "Joining…" : "Join waitlist"}
          <span style={{ opacity: 0.6 }}>→</span>
        </button>
      </div>
      {state === "error" && errMsg && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--down)" }}>
          ⚠ {errMsg.replaceAll("_", " ")}
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 12, color: "var(--fg-3)" }}>
        <span style={{ color: "var(--up)" }}>◆ free launch credits</span>
        {" · no spam · unsubscribe anytime"}
      </div>
    </form>
  );
}

function readUtm() {
  if (typeof window === "undefined") return undefined;
  const p = new URLSearchParams(window.location.search);
  const utm = {
    source: p.get("utm_source") ?? undefined,
    medium: p.get("utm_medium") ?? undefined,
    campaign: p.get("utm_campaign") ?? undefined,
  };
  if (!utm.source && !utm.medium && !utm.campaign) return undefined;
  return utm;
}
