import { pickFromHash } from "./hash";
import {
  BODIES,
  TAILS,
  TOP_FINS,
  BOT_FINS,
  EYES,
  MOUTHS,
  PATTERNS,
  PALETTES,
  BACKGROUNDS,
  W,
  H,
  type Cell,
  type PatternName,
} from "./parts";

export type Rect = { x: number; y: number; color: string };

export type FishRender = {
  rects: Rect[];
  background: string;
  viewBox: string;
};

function patternMatch(name: PatternName, x: number, y: number, isEdge: boolean): boolean {
  switch (name) {
    case "solid":
      return false;
    case "vstripes":
      return x % 3 === 0;
    case "hstripes":
      return y % 2 === 0;
    case "spots":
      return (x + y * 2) % 4 === 0;
    case "speckle":
      return (x * 7 + y * 3) % 6 === 0;
    case "edge-dark":
      return isEdge;
    case "underbelly":
      return y >= 7;
    case "chevron":
      return (x - y + 16) % 5 === 0;
    case "scales":
      return (x + y) % 3 === 0 && y % 2 === 0;
    case "dotted":
      return x % 2 === 0 && y % 2 === 0;
  }
}

export function renderFish(seed: string): FishRender {
  const body = BODIES[pickFromHash(seed, "body", BODIES.length)];
  const tail = TAILS[pickFromHash(seed, "tail", TAILS.length)];
  const topFin = TOP_FINS[pickFromHash(seed, "topfin", TOP_FINS.length)];
  const botFin = BOT_FINS[pickFromHash(seed, "botfin", BOT_FINS.length)];
  const eye = EYES[pickFromHash(seed, "eye", EYES.length)];
  const mouth = MOUTHS[pickFromHash(seed, "mouth", MOUTHS.length)];
  const pattern = PATTERNS[pickFromHash(seed, "pattern", PATTERNS.length)];
  const palette = PALETTES[pickFromHash(seed, "palette", PALETTES.length)];
  const bg = BACKGROUNDS[pickFromHash(seed, "bg", BACKGROUNDS.length)];

  const [primary, secondary, finColor] = palette;

  // Set of body cells for fast neighbor lookup (edge-dark pattern)
  const bodySet = new Set<string>();
  for (const [x, y] of body.cells) bodySet.add(`${x},${y}`);
  const isBody = (x: number, y: number) => bodySet.has(`${x},${y}`);

  const rects: Rect[] = [];

  // Layer 1: tail (behind body)
  const [tx, ty] = body.anchors.tail;
  for (const [dx, dy] of tail.cells) {
    rects.push({ x: tx + dx, y: ty + dy, color: primary });
  }

  // Layer 2: top fin
  const [tfx, tfy] = body.anchors.topFin;
  for (const [dx, dy] of topFin.cells) {
    rects.push({ x: tfx + dx, y: tfy + dy, color: finColor });
  }

  // Layer 3: bottom fin
  const [bfx, bfy] = body.anchors.bottomFin;
  for (const [dx, dy] of botFin.cells) {
    rects.push({ x: bfx + dx, y: bfy + dy, color: finColor });
  }

  // Layer 4: body with pattern overlay (covers any tail cells inside body)
  for (const [x, y] of body.cells) {
    const edge =
      !isBody(x - 1, y) ||
      !isBody(x + 1, y) ||
      !isBody(x, y - 1) ||
      !isBody(x, y + 1);
    const usePattern = patternMatch(pattern, x, y, edge && pattern === "edge-dark");
    rects.push({ x, y, color: usePattern ? secondary : primary });
  }

  // Layer 5: eye (2x2 sprite)
  const [ex, ey] = body.anchors.eye;
  for (let dy = 0; dy < 2; dy++) {
    const row = eye.sprite[dy];
    for (let dx = 0; dx < 2; dx++) {
      const c = row[dx];
      if (c === "W") rects.push({ x: ex + dx, y: ey + dy, color: "#ffffff" });
      else if (c === "P") rects.push({ x: ex + dx, y: ey + dy, color: "#0a0a0a" });
      else if (c === "S") rects.push({ x: ex + dx, y: ey + dy, color: "#ffffff" });
      // "." = transparent: skip
    }
  }

  // Layer 6: mouth
  const [mx, my] = body.anchors.mouth;
  for (const [dx, dy] of mouth.cells) {
    rects.push({ x: mx + dx, y: my + dy, color: "#0a0a0a" });
  }

  return {
    rects,
    background: bg,
    viewBox: `0 0 ${W} ${H}`,
  };
}

export function avatarDims() {
  return { W, H };
}
