"use client";
import { cn } from "@/lib/utils";
import React, { ReactNode } from "react";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children?: ReactNode;
  showRadialGradient?: boolean;
  /**
   * `asLayer` strips the `<main>` wrapper and the full-screen flex layout
   * so the component can be dropped in as a stacking-context background
   * layer. Use this when AuroraBackground is composited *behind* other
   * content (e.g., the hero swarm) rather than wrapping the whole hero.
   */
  asLayer?: boolean;
}

export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  asLayer = false,
  ...props
}: AuroraBackgroundProps) => {
  // Ocean palette override — cyan / teal / mint phosphor, anchored to the
  // top so the aurora reads as sunlight filtering down through deep water
  // rather than generic northern lights. The CSS vars below are the
  // colors the inner div's `[--aurora]` arbitrary class consumes via
  // inline-style precedence.
  const oceanVars = {
    "--aurora":
      "repeating-linear-gradient(100deg,#a8d8e8_10%,#2dd4ff_15%,#7fe0a8_20%,#4ce8c4_25%,#6bc8e0_30%)",
    "--dark-gradient":
      "repeating-linear-gradient(100deg,#000_0%,#000_7%,transparent_10%,transparent_12%,#000_16%)",
    "--white-gradient":
      "repeating-linear-gradient(100deg,#fff_0%,#fff_7%,transparent_10%,transparent_12%,#fff_16%)",
    "--blue-300": "#a8d8e8",
    "--blue-400": "#6bc8e0",
    "--blue-500": "#2dd4ff",
    "--indigo-300": "#7fe0a8",
    "--violet-200": "#4ce8c4",
    "--black": "#000",
    "--white": "#fff",
    "--transparent": "transparent",
  } as React.CSSProperties;

  const auroraDiv = (
    <div
      className={cn(
        // Outer aurora layer. In layer-mode it's absolutely positioned so
        // it can be stacked behind other content; otherwise it fills its
        // parent (the AuroraBackground main wrapper).
        asLayer
          ? "pointer-events-none absolute inset-0 overflow-hidden"
          : "absolute inset-0 overflow-hidden",
      )}
      style={oceanVars}
    >
      <div
        className={cn(
          // Ocean override: brighter (opacity 50→80), softer blur (10→6),
          // and screen blend (was difference) so cyan/mint reads as ADDED
          // sunlight against the dark ocean bg, not subtracted.
          `after:animate-aurora pointer-events-none absolute -inset-[10px] [background-image:var(--white-gradient),var(--aurora)] [background-size:300%,_200%] [background-position:50%_50%,50%_50%] opacity-80 blur-[6px] mix-blend-screen filter will-change-transform [--aurora:repeating-linear-gradient(100deg,var(--blue-500)_10%,var(--indigo-300)_15%,var(--blue-300)_20%,var(--violet-200)_25%,var(--blue-400)_30%)] [--dark-gradient:repeating-linear-gradient(100deg,var(--black)_0%,var(--black)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--black)_16%)] [--white-gradient:repeating-linear-gradient(100deg,var(--white)_0%,var(--white)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--white)_16%)] after:absolute after:inset-0 after:[background-image:var(--dark-gradient),var(--aurora)] after:[background-size:200%,_100%] after:[background-attachment:fixed] after:mix-blend-screen after:content-[""] dark:[background-image:var(--dark-gradient),var(--aurora)] after:dark:[background-image:var(--dark-gradient),var(--aurora)]`,
          // Radial mask: layer-mode anchors at `50% 0%` (top-center) so
          // the aurora glow concentrates near the top of the canvas
          // (sunlight from above). Default aceternity preset anchors at
          // top-right which doesn't fit our centered hero composition.
          showRadialGradient &&
            (asLayer
              ? "[mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black_30%,transparent_75%)]"
              : "[mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,var(--transparent)_70%)]"),
        )}
      />
    </div>
  );

  if (asLayer) {
    // Background-layer mode: just return the positioned aurora div.
    // Caller wraps it in their own stacking context with appropriate
    // z-index. No children rendered — this is a background, not a
    // wrapper.
    return auroraDiv;
  }

  return (
    <main>
      <div
        className={cn(
          "transition-bg relative flex h-[100vh] flex-col items-center justify-center bg-zinc-50 text-slate-950 dark:bg-zinc-900",
          className,
        )}
        {...props}
      >
        {auroraDiv}
        {children}
      </div>
    </main>
  );
};
