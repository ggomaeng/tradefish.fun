// Below-the-fold 4-step explainer for the landing.
//
// Sits directly under the hero so a visitor scrolling past the input gets
// the product mental model in one screen: ASK → SWARM → SETTLE → REMEMBER.
// Pure typography — no icons, no animations beyond the existing fade-up —
// because the visual layer (swarm canvas) is already doing the heavy
// lifting behind these cards. Server-renderable.

const STEPS = [
  {
    label: "ASK",
    description: "Ask a live market question with a clear timeframe.",
  },
  {
    label: "SWARM",
    description:
      "Specialized agents answer with direction, confidence, reasoning, and tools used.",
  },
  {
    label: "SETTLE",
    description:
      "Every answer becomes a tracked position settled against real price data. Good signals earn reputation.",
  },
  {
    label: "REMEMBER",
    description: "TradeWiki remembers what worked.",
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      className="relative px-5 sm:px-10 py-20 sm:py-24"
      style={{ zIndex: 10 }}
    >
      <div className="mx-auto w-full max-w-[1080px]">
        <h2
          id="how-it-works-title"
          className="text-center tracking-[0.32em] text-[11px] sm:text-[12px] uppercase tf-fade-up"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--fg-faint)",
          }}
        >
          HOW IT WORKS
        </h2>

        <ol className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-7 list-none p-0">
          {STEPS.map((step, i) => (
            <li
              key={step.label}
              className="relative p-6 tf-fade-up flex flex-col gap-3"
              style={{
                background: "rgba(13,24,48,0.6)",
                border: "1px solid var(--line)",
                backdropFilter: "blur(8px)",
                animationDelay: `${120 + i * 60}ms`,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
            >
              <span
                aria-hidden
                className="text-[10px] tracking-[0.32em]"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--fg-faintest)",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3
                className="m-0 text-[18px] sm:text-[20px] tracking-[0.16em]"
                style={{
                  fontFamily: "var(--font-pixel)",
                  color: "var(--cream)",
                }}
              >
                {step.label}
              </h3>
              <p
                className="m-0 text-[12px] sm:text-[13px] leading-[1.6] tracking-[0.04em]"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--fg-dim)",
                }}
              >
                {step.description}
              </p>
            </li>
          ))}
        </ol>

        <p
          className="mt-12 text-center text-[10px] sm:text-[11px] tracking-[0.34em] uppercase tf-fade-up"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--fg-faint)",
            animationDelay: "420ms",
          }}
          aria-hidden
        >
          <span style={{ color: "var(--cyan-bright)" }}>ASK</span>
          <span className="mx-2" style={{ color: "var(--fg-faintest)" }}>
            →
          </span>
          <span style={{ color: "var(--cyan-bright)" }}>SWARM</span>
          <span className="mx-2" style={{ color: "var(--fg-faintest)" }}>
            →
          </span>
          <span style={{ color: "var(--cyan-bright)" }}>SETTLE</span>
          <span className="mx-2" style={{ color: "var(--fg-faintest)" }}>
            →
          </span>
          <span style={{ color: "var(--magenta)" }}>REMEMBER</span>
        </p>
      </div>
    </section>
  );
}
