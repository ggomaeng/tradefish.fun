"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Children, type ReactNode } from "react";

/* ─────────────────────────────────────────────────────────
 * Reveal — scroll-triggered fade + slide for below-fold sections.
 *
 * Two exports:
 *   <RevealStagger> — wraps each direct child in a motion.div
 *                     with index-based delay (cascade entry).
 *                     Use for grids/lists where items should
 *                     appear sequentially as the section scrolls
 *                     into view.
 *
 *   <RevealSection> — single fade+slide for a whole section.
 *                     Use when there's nothing to stagger.
 *
 * Both honor prefers-reduced-motion (returns children verbatim).
 * Both use viewport={{ once: true }} so animations don't repeat
 * on scroll-up.
 *
 * Hero choreography is NOT handled here — that uses the CSS
 * .fade-up class with animationDelay, which is SSR-friendly.
 * Reveal is for the post-hero sections only.
 * ───────────────────────────────────────────────────────── */

const SPRING_CARD = { type: "spring" as const, stiffness: 260, damping: 26 };
const SPRING_PILL = { type: "spring" as const, stiffness: 320, damping: 28 };

export function RevealStagger({
  children,
  stagger = 0.1,
  offsetY = 16,
  amount = 0.3,
  variant = "card",
}: {
  children: ReactNode;
  /** Seconds between each child's entrance. */
  stagger?: number;
  /** Pixels each child slides up from. */
  offsetY?: number;
  /** Fraction of element visible before triggering (0-1). */
  amount?: number;
  /** Spring preset — `card` for content cards, `pill` for tighter elements. */
  variant?: "card" | "pill";
}) {
  const reduced = useReducedMotion();
  const spring = variant === "pill" ? SPRING_PILL : SPRING_CARD;

  return (
    <>
      {Children.map(children, (child, i) => {
        if (reduced) return child;
        return (
          <motion.div
            initial={{ opacity: 0, y: offsetY }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount }}
            transition={{ ...spring, delay: i * stagger }}
          >
            {child}
          </motion.div>
        );
      })}
    </>
  );
}

export function RevealSection({
  children,
  offsetY = 20,
  delay = 0,
  amount = 0.2,
}: {
  children: ReactNode;
  offsetY?: number;
  delay?: number;
  amount?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0, y: offsetY }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ ...SPRING_CARD, delay }}
    >
      {children}
    </motion.div>
  );
}
