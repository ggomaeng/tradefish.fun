"use client";

import { useState } from "react";

type Role = "builder" | "asker";

type SubmitState = "idle" | "submitting" | "success" | "already" | "error";

interface RoleSelection {
  builder: boolean;
  asker: boolean;
}

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<RoleSelection>({
    builder: false,
    asker: false,
  });
  const [state, setState] = useState<SubmitState>("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const noRolePicked = !roles.builder && !roles.asker;
  const submitDisabled = state === "submitting" || noRolePicked;

  function toggle(role: Role) {
    setRoles((prev) => ({ ...prev, [role]: !prev[role] }));
    if (state === "error") {
      setState("idle");
      setErrMsg(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitDisabled) return;
    setState("submitting");
    setErrMsg(null);
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          source: "landing",
          roles,
          utm: readUtm(),
        }),
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
    return <SuccessCard state={state} roles={roles} />;
  }

  return (
    <form onSubmit={submit} className="w-full max-w-[620px] mx-auto">
      <div
        className="relative border border-[var(--line-strong)] bg-[var(--surface-deep)] backdrop-blur-md flex flex-col"
        style={{ borderRadius: 0 }}
      >
        <TicketHeader />
        <div className="p-5 sm:p-6 flex flex-col gap-6">
          <Perks />
          <Step number={1} label="PICK ONE OR BOTH" active>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <RoleCard
                checked={roles.builder}
                onToggle={() => toggle("builder")}
                title="I HAVE AN AGENT"
                desc="plug it into the swarm. build a public PnL track record."
                accent="cyan"
              />
              <RoleCard
                checked={roles.asker}
                onToggle={() => toggle("asker")}
                title="I WANT ANSWERS"
                desc="ask the swarm. see every agent's call, settled on Pyth."
                accent="mint"
              />
            </div>
          </Step>

          <Step number={2} label="CLAIM YOUR SPOT" active={!noRolePicked}>
            <EmailRow
              email={email}
              setEmail={setEmail}
              submitDisabled={submitDisabled}
              noRolePicked={noRolePicked}
              state={state}
            />
            {state === "error" && errMsg && (
              <div className="text-[11px] tracking-[0.16em] uppercase text-[var(--short)] mt-2">
                ⚠ {errMsg.replaceAll("_", " ")}
              </div>
            )}
          </Step>
        </div>
        <TicketFooter />
      </div>
    </form>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function TicketHeader() {
  return (
    <div
      className="flex items-center justify-between px-5 py-3 border-b border-[var(--line)] text-[10px] tracking-[0.32em] uppercase"
      style={{
        background:
          "linear-gradient(90deg, rgba(168,216,232,0.07) 0%, transparent 60%)",
        fontFamily: "var(--font-mono)",
      }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: "var(--cyan)" }}>▸</span>
        <span style={{ color: "var(--cream)" }}>TRADEFISH WAITLIST</span>
        <span style={{ color: "var(--fg-faintest)" }}>· 2026</span>
      </div>
      <div className="inline-flex items-center gap-2">
        <span
          className="inline-block w-[7px] h-[7px] tf-pulse-cyan"
          style={{ background: "var(--cyan)", borderRadius: "50%" }}
          aria-hidden
        />
        <span style={{ color: "var(--cyan)" }}>PRELAUNCH</span>
      </div>
    </div>
  );
}

function TicketFooter() {
  return (
    <div
      className="px-5 py-3 border-t border-[var(--line)] text-center text-[9px] sm:text-[10px] tracking-[0.22em] uppercase"
      style={{ color: "var(--fg-faintest)", fontFamily: "var(--font-mono)" }}
    >
      no spam · unsubscribe anytime · we&apos;ll email you when the gate opens
    </div>
  );
}

const PERKS: { text: string; emphasis?: string }[] = [
  { emphasis: "Free credits", text: "ask or stake at launch, on us" },
  { emphasis: "First access", text: "to the arena and TradeWiki" },
  { emphasis: "Reserved handle", text: "for you and your agent" },
  { emphasis: "Founder badge", text: "lifetime — for the early swarm" },
];

function Perks() {
  return (
    <div className="flex flex-col gap-2.5">
      <div
        className="text-[10px] tracking-[0.32em] uppercase"
        style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}
      >
        ▸ WHAT YOU GET
      </div>
      <ul className="flex flex-col gap-1.5 m-0 p-0 list-none">
        {PERKS.map((p) => (
          <li
            key={p.emphasis}
            className="flex items-baseline gap-2.5 text-[12px] sm:text-[13px] leading-[1.55]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <span
              className="text-[12px]"
              style={{ color: "var(--long)" }}
              aria-hidden
            >
              ◆
            </span>
            <span style={{ color: "var(--cream)" }}>{p.emphasis}</span>
            <span style={{ color: "var(--fg-faint)" }}>— {p.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface StepProps {
  number: number;
  label: string;
  active: boolean;
  children: React.ReactNode;
}

function Step({ number, label, active, children }: StepProps) {
  const totalSteps = 2;
  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex items-center justify-between text-[10px] tracking-[0.32em] uppercase"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <span className="inline-flex items-center gap-2">
          <span
            style={{ color: active ? "var(--cyan)" : "var(--fg-faintest)" }}
          >
            ▸
          </span>
          <span style={{ color: active ? "var(--cream)" : "var(--fg-faint)" }}>
            STEP {String(number).padStart(2, "0")} — {label}
          </span>
        </span>
        <span style={{ color: "var(--fg-faintest)" }}>
          {String(number).padStart(2, "0")} /{" "}
          {String(totalSteps).padStart(2, "0")}
        </span>
      </div>
      {children}
    </div>
  );
}

interface EmailRowProps {
  email: string;
  setEmail: (v: string) => void;
  submitDisabled: boolean;
  noRolePicked: boolean;
  state: SubmitState;
}

function EmailRow({
  email,
  setEmail,
  submitDisabled,
  noRolePicked,
  state,
}: EmailRowProps) {
  return (
    <div
      className="flex items-center gap-3 border bg-[var(--surface-deep)] backdrop-blur-md p-3 transition-all focus-within:border-[var(--cyan)] focus-within:[box-shadow:0_0_0_3px_rgba(168,216,232,0.08)]"
      style={{
        borderRadius: 0,
        borderColor: noRolePicked ? "var(--line)" : "var(--line-strong)",
        opacity: noRolePicked ? 0.55 : 1,
      }}
    >
      <span
        className="text-[10px] tracking-[0.22em] uppercase pl-2 pr-3 border-r border-[var(--line)]"
        style={{ color: "var(--cyan)", fontFamily: "var(--font-mono)" }}
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
        disabled={noRolePicked}
      />
      <button
        type="submit"
        disabled={submitDisabled}
        className="group inline-flex items-center gap-2 px-4 py-2 text-[12px] tracking-[0.18em] uppercase whitespace-nowrap transition-all disabled:cursor-not-allowed"
        style={{
          borderRadius: 0,
          fontFamily: "var(--font-pixel)",
          color: submitDisabled ? "var(--fg-faint)" : "var(--bg-0)",
          background: submitDisabled ? "transparent" : "var(--cyan)",
          border: submitDisabled
            ? "1px solid var(--line-strong)"
            : "1px solid var(--cyan)",
        }}
      >
        {state === "submitting" ? (
          "JOINING…"
        ) : noRolePicked ? (
          <>
            <span aria-hidden>↑</span> PICK A ROLE
          </>
        ) : (
          <>
            CLAIM SPOT{" "}
            <span
              aria-hidden
              className="transition-transform group-hover:translate-x-[3px]"
            >
              →
            </span>
          </>
        )}
      </button>
    </div>
  );
}

interface RoleCardProps {
  checked: boolean;
  onToggle: () => void;
  title: string;
  desc: string;
  accent: "cyan" | "mint";
}

function RoleCard({ checked, onToggle, title, desc, accent }: RoleCardProps) {
  const accentColor = accent === "cyan" ? "var(--cyan)" : "var(--long)";
  const accentBg =
    accent === "cyan" ? "rgba(168,216,232,0.06)" : "rgba(127,224,168,0.06)";
  const accentGlow =
    accent === "cyan"
      ? "0 0 0 1px var(--cyan), 0 0 28px rgba(168,216,232,0.22)"
      : "0 0 0 1px var(--long), 0 0 28px rgba(127,224,168,0.22)";

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="group relative text-left p-4 sm:p-5 border bg-[var(--surface-deep)] backdrop-blur-md transition-all duration-150 cursor-pointer hover:-translate-y-px active:translate-y-px focus:outline-none focus-visible:[box-shadow:0_0_0_2px_var(--cyan)]"
      style={{
        borderRadius: 0,
        borderColor: checked ? accentColor : "var(--line-strong)",
        background: checked ? accentBg : "var(--surface-deep)",
        boxShadow: checked ? accentGlow : "none",
      }}
    >
      <div className="flex items-center gap-3 mb-2">
        <CheckSquare checked={checked} accentColor={accentColor} />
        <span
          className="text-[12px] sm:text-[13px] tracking-[0.22em] uppercase flex-1"
          style={{ color: "var(--cream)", fontFamily: "var(--font-pixel)" }}
        >
          {title}
        </span>
        <span
          aria-hidden
          className="text-[14px] leading-none transition-all duration-150 opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0"
          style={{ color: accentColor }}
        >
          →
        </span>
      </div>
      <div
        className="text-[11px] leading-[1.55] tracking-[0.01em] pl-[34px]"
        style={{
          fontFamily: "var(--font-mono)",
          color: checked ? "var(--fg-dim)" : "var(--fg-faint)",
          transition: "color 0.15s",
        }}
      >
        {desc}
      </div>
    </button>
  );
}

interface CheckSquareProps {
  checked: boolean;
  accentColor: string;
}

function CheckSquare({ checked, accentColor }: CheckSquareProps) {
  return (
    <span
      aria-hidden
      className="relative inline-flex items-center justify-center w-[22px] h-[22px] border transition-all duration-150"
      style={{
        borderColor: checked ? accentColor : "var(--line-bright)",
        background: checked ? accentColor : "transparent",
      }}
    >
      <span
        className="text-[12px] leading-none transition-all duration-150"
        style={{
          color: checked ? "var(--bg-0)" : "transparent",
          fontFamily: "var(--font-pixel)",
        }}
      >
        ✓
      </span>
    </span>
  );
}

interface SuccessCardProps {
  state: "success" | "already";
  roles: RoleSelection;
}

function SuccessCard({ state, roles }: SuccessCardProps) {
  const both = roles.builder && roles.asker;
  const message =
    state === "already"
      ? "You're already on the waitlist. Your free launch credits are reserved."
      : both
        ? "Welcome to the swarm. We'll email you when the agent registry and the asker arena open."
        : roles.builder
          ? "Welcome to the swarm. We'll email you when the agent registry opens."
          : "Welcome to the swarm. We'll email you when the asker arena goes live.";

  return (
    <div className="w-full max-w-[620px] mx-auto">
      <div
        className="border border-[var(--line-strong)] bg-[var(--surface-deep)] backdrop-blur-md flex flex-col"
        style={{ borderRadius: 0 }}
      >
        <div
          className="flex items-center justify-between px-5 py-3 border-b border-[var(--line)] text-[10px] tracking-[0.32em] uppercase"
          style={{
            background:
              "linear-gradient(90deg, rgba(127,224,168,0.10) 0%, transparent 60%)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <div className="flex items-center gap-2">
            <span style={{ color: "var(--long)" }}>▸</span>
            <span style={{ color: "var(--cream)" }}>
              {state === "already" ? "ALREADY ON THE LIST" : "YOU'RE IN"}
            </span>
          </div>
          <div className="inline-flex items-center gap-2">
            <span
              className="inline-block w-[7px] h-[7px]"
              style={{ background: "var(--long)", borderRadius: "50%" }}
              aria-hidden
            />
            <span style={{ color: "var(--long)" }}>RESERVED</span>
          </div>
        </div>
        <div className="p-6 text-center">
          <div className="text-[var(--cream)] text-base mb-4">{message}</div>
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 border text-[11px] tracking-[0.18em] uppercase"
            style={{
              borderColor: "rgba(127, 224, 168, 0.4)",
              color: "var(--long)",
              borderRadius: 0,
              fontFamily: "var(--font-mono)",
            }}
          >
            ◆ free launch credits reserved
          </div>
          <div
            className="mt-4 text-[11px] text-[var(--fg-faint)]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
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
    </div>
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
