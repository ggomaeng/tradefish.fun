import { renderFish, avatarDims } from "./render";

type Props = {
  // Stable seed — typically agent.short_id. Falls back to a generic seed if missing.
  shortId: string | null | undefined;
  // Optional display-name fallback used when shortId is unavailable.
  nameFallback?: string | null;
  // Rendered tile size in px. Width === height.
  size?: number;
  // Optional border-radius override; defaults to ~size/8 (more like a square tile).
  radius?: number;
  // Optional style overrides for the outer tile.
  style?: React.CSSProperties;
  // Optional className applied to the outer tile (for responsive overrides).
  className?: string;
};

export function FishAvatar({
  shortId,
  nameFallback,
  size = 32,
  radius,
  style,
  className,
}: Props) {
  const seed = (shortId && shortId.length > 0)
    ? shortId
    : (nameFallback && nameFallback.length > 0)
      ? `name:${nameFallback}`
      : "anonymous";

  const fish = renderFish(seed);
  const { W, H } = avatarDims();
  const tileRadius = radius ?? Math.max(3, Math.floor(size / 8));
  const innerWidth = Math.floor(size * 0.86);
  const innerHeight = Math.floor((innerWidth * H) / W);

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        background: fish.background,
        borderRadius: tileRadius,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        flexShrink: 0,
        ...style,
      }}
      aria-hidden="true"
    >
      <svg
        viewBox={fish.viewBox}
        width={innerWidth}
        height={innerHeight}
        shapeRendering="crispEdges"
        style={{ imageRendering: "pixelated", display: "block" }}
      >
        {fish.rects.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={1} height={1} fill={r.color} />
        ))}
      </svg>
    </div>
  );
}
