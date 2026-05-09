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
      <div className="w-full max-w-[520px] mx-auto tf-fade-up">
        <div
          className="border border-[var(--line-strong)] bg-[var(--surface-deep)] backdrop-blur-md p-6 text-center"
          style={{ borderRadius: 0 }}
        >
          <div
            className="text-[10px] tracking-[0.32em] uppercase mb-2"
            style={{ color: "var(--cyan)" }}
          >
            ▣ {state === "already" ? "ALREADY ON THE LIST" : "YOU'RE IN"}
          </div>
          <div className="text-[var(--cream)] text-base">
            {state === "already"
              ? "You're already on the waitlist. Your free launch credits are reserved."
              : "Welcome to the swarm. We'll email you when the arena opens."}
          </div>
          <div
            className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 border text-[11px] tracking-[0.18em] uppercase"
            style={{
              borderColor: "rgba(127, 224, 168, 0.4)",
              color: "var(--long)",
              borderRadius: 0,
            }}
          >
            ◆ free launch credits reserved
          </div>
          <div className="mt-4 text-[11px] text-[var(--fg-faint)]">
            Follow{" "}
            <a
              href="https://x.com/tradefish_fun"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--cyan)] hover:text-[var(--cyan-bright)]"
            >
              @tradefish_fun
            </a>{" "}
            for launch updates.
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-[520px] mx-auto tf-fade-up"
      style={{ animationDelay: "120ms" }}
    >
      <div
        className="flex items-center gap-3 border border-[var(--line-strong)] bg-[var(--surface-deep)] backdrop-blur-md p-3 transition-colors focus-within:border-[var(--cyan)] focus-within:[box-shadow:0_0_0_3px_rgba(168,216,232,0.08)]"
        style={{ borderRadius: 0 }}
      >
        <span
          className="text-[10px] tracking-[0.22em] uppercase pl-2 pr-3 border-r border-[var(--line)]"
          style={{ color: "var(--cyan)" }}
        >
          ▸ EMAIL
        </span>
        <input
          type="email"
          required
          autoComplete="email"
          spellCheck={false}
          placeholder="you@somewhere.fun"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 bg-transparent border-0 outline-none text-[var(--cream)] text-[14px] tracking-[0.01em] placeholder:text-[var(--fg-faintest)]"
          style={{ fontFamily: "var(--font-mono)" }}
        />
        <button
          type="submit"
          disabled={state === "submitting"}
          className="px-4 py-2 text-[12px] tracking-[0.18em] uppercase text-[var(--bg-0)] bg-[var(--cyan)] hover:bg-[var(--cyan-bright)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          style={{ borderRadius: 0, fontFamily: "var(--font-pixel)" }}
        >
          {state === "submitting" ? "JOINING…" : "JOIN WAITLIST →"}
        </button>
      </div>
      {state === "error" && errMsg && (
        <div className="mt-3 text-[11px] tracking-[0.16em] uppercase text-[var(--short)]">
          ⚠ {errMsg.replaceAll("_", " ")}
        </div>
      )}
      <div className="mt-3 text-[10px] tracking-[0.2em] uppercase text-[var(--fg-faintest)] text-center">
        <span style={{ color: "var(--long)" }}>◆ free credits at launch</span>
        {" · "}no spam · unsubscribe anytime
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
