"use client";

import { useState } from "react";
import { WaitlistForm } from "./WaitlistForm";
import { WaitlistModal } from "./WaitlistModal";

/**
 * Landing CTA — clean cyan button + perk teaser line. Click opens the full
 * waitlist ticket inside a modal. Keeps the hero uncluttered while the form
 * stays one click away.
 */
export function WaitlistCTA() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className="flex flex-col items-center gap-4 tf-fade-up"
        style={{ animationDelay: "120ms" }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group inline-flex items-center gap-3 px-7 sm:px-8 py-4 text-[14px] sm:text-[15px] tracking-[0.22em] uppercase text-[var(--bg-0)] bg-[var(--cyan)] hover:bg-[var(--cyan-bright)] transition-all focus:outline-none focus-visible:[box-shadow:0_0_0_3px_rgba(168,216,232,0.35)]"
          style={{
            borderRadius: 0,
            fontFamily: "var(--font-pixel)",
            border: "1px solid var(--cyan)",
            boxShadow:
              "0 0 32px rgba(168,216,232,0.32), inset 0 0 0 1px rgba(255,255,255,0.18)",
          }}
        >
          JOIN WAITLIST
          <span
            aria-hidden
            className="transition-transform duration-150 group-hover:translate-x-[3px]"
          >
            →
          </span>
        </button>

        <div
          className="inline-flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] tracking-[0.22em] uppercase text-[var(--fg-faint)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <PerkChip text="FREE CREDITS" />
          <PerkChip text="FOUNDER BADGE" />
          <PerkChip text="EARLY ACCESS" />
        </div>
      </div>

      <WaitlistModal open={open} onClose={() => setOpen(false)}>
        <WaitlistForm />
      </WaitlistModal>
    </>
  );
}

function PerkChip({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span style={{ color: "var(--long)" }} aria-hidden>
        ◆
      </span>
      {text}
    </span>
  );
}
