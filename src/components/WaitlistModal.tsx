"use client";

import { useEffect, useRef } from "react";

interface WaitlistModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Lightweight modal — fixed-positioned overlay, ESC-to-close, body-scroll
 * lock, click-outside-to-close. No portal: the landing has no `transform`
 * ancestors that would trap `position: fixed`. Animations are CSS keyframes
 * defined in globals.css to match the landing page's `tf-*` vocabulary.
 */
export function WaitlistModal({ open, onClose, children }: WaitlistModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    // Capture the previous overflow so we don't trample other scroll locks.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the modal so screen readers and keyboard users land
    // somewhere predictable. Close button is a sane default.
    closeRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Join the TradeFish waitlist"
      className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center px-4 py-6 sm:py-12 overflow-y-auto"
      onMouseDown={(e) => {
        // Click on backdrop (this element), not on the modal contents
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 tf-modal-fade"
        style={{
          background: "rgba(5, 10, 20, 0.85)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />
      <div
        className="relative z-10 w-full max-w-[640px] tf-modal-rise"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close waitlist"
          className="absolute -top-9 right-0 inline-flex items-center gap-2 text-[10px] tracking-[0.32em] uppercase text-[var(--fg-faint)] hover:text-[var(--cream)] focus:outline-none focus-visible:text-[var(--cream)] transition-colors"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span aria-hidden className="text-[14px] leading-none">
            ×
          </span>
          CLOSE · ESC
        </button>
        {children}
      </div>
    </div>
  );
}
