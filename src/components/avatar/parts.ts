// Pixel-art parts library for FishAvatar. Pure data — pick a row, get a part.
// All sprites occupy a 16-wide × 12-tall grid. Bodies expose explicit anchors
// so tails/fins/eyes/mouths attach correctly across silhouettes.

export const W = 16;
export const H = 12;

export type Cell = readonly [number, number];

export type Anchors = {
  eye: Cell;
  mouth: Cell;
  tail: Cell;
  topFin: Cell;
  bottomFin: Cell;
};

export type Body = {
  name: string;
  cells: Cell[];
  anchors: Anchors;
};

export type Part = {
  name: string;
  cells: readonly Cell[];
};

export type Eye = {
  name: string;
  // 2x2 sprite. W = eye-white, P = pupil/dark, S = highlight, . = transparent.
  sprite: readonly [string, string];
};

export type Palette = readonly [primary: string, secondary: string, fin: string];

export type PatternName =
  | "solid"
  | "vstripes"
  | "hstripes"
  | "spots"
  | "speckle"
  | "edge-dark"
  | "underbelly"
  | "chevron"
  | "scales"
  | "dotted";

function parseGrid(rows: string[]): Cell[] {
  const out: Cell[] = [];
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "X") out.push([x, y]);
    }
  }
  return out;
}

// ============================================================================
// BODIES
// ============================================================================

export const BODIES: Body[] = [
  {
    name: "oval",
    cells: parseGrid([
      "                ",
      "                ",
      "                ",
      "     XXXXXX     ",
      "   XXXXXXXXXX   ",
      "   XXXXXXXXXX   ",
      "   XXXXXXXXXX   ",
      "   XXXXXXXXXX   ",
      "   XXXXXXXXXX   ",
      "     XXXXXX     ",
      "                ",
      "                ",
    ]),
    anchors: { eye: [5, 5], mouth: [3, 7], tail: [13, 6], topFin: [7, 2], bottomFin: [7, 10] },
  },
  {
    name: "round",
    cells: parseGrid([
      "                ",
      "       XX       ",
      "     XXXXXX     ",
      "    XXXXXXXX    ",
      "   XXXXXXXXXX   ",
      "   XXXXXXXXXX   ",
      "   XXXXXXXXXX   ",
      "   XXXXXXXXXX   ",
      "   XXXXXXXXXX   ",
      "    XXXXXXXX    ",
      "     XXXXXX     ",
      "       XX       ",
    ]),
    anchors: { eye: [5, 5], mouth: [3, 7], tail: [13, 6], topFin: [7, 0], bottomFin: [7, 11] },
  },
  {
    name: "slim",
    cells: parseGrid([
      "                ",
      "                ",
      "                ",
      "                ",
      "    XXXXXXXXX   ",
      "   XXXXXXXXXX   ",
      "   XXXXXXXXXX   ",
      "    XXXXXXXXX   ",
      "                ",
      "                ",
      "                ",
      "                ",
    ]),
    anchors: { eye: [4, 5], mouth: [3, 6], tail: [13, 6], topFin: [7, 3], bottomFin: [7, 8] },
  },
  {
    name: "disc",
    cells: parseGrid([
      "       XX       ",
      "      XXXX      ",
      "     XXXXXX     ",
      "    XXXXXXXX    ",
      "   XXXXXXXXXX   ",
      "   XXXXXXXXXX   ",
      "   XXXXXXXXXX   ",
      "   XXXXXXXXXX   ",
      "    XXXXXXXX    ",
      "     XXXXXX     ",
      "      XXXX      ",
      "       XX       ",
    ]),
    anchors: { eye: [5, 5], mouth: [3, 7], tail: [13, 6], topFin: [7, 0], bottomFin: [7, 11] },
  },
  {
    name: "torpedo",
    cells: parseGrid([
      "                ",
      "                ",
      "                ",
      "                ",
      "      XXXXXX    ",
      "  XXXXXXXXXXX   ",
      "  XXXXXXXXXXX   ",
      "      XXXXXX    ",
      "                ",
      "                ",
      "                ",
      "                ",
    ]),
    anchors: { eye: [4, 5], mouth: [2, 6], tail: [13, 6], topFin: [8, 3], bottomFin: [8, 8] },
  },
  {
    name: "chunky",
    cells: parseGrid([
      "                ",
      "                ",
      "    XXXXXXXXX   ",
      "   XXXXXXXXXX   ",
      "   XXXXXXXXXX   ",
      "   XXXXXXXXXX   ",
      "   XXXXXXXXXX   ",
      "   XXXXXXXXXX   ",
      "   XXXXXXXXXX   ",
      "   XXXXXXXXXX   ",
      "    XXXXXXXXX   ",
      "                ",
    ]),
    anchors: { eye: [5, 5], mouth: [3, 7], tail: [13, 6], topFin: [7, 1], bottomFin: [7, 11] },
  },
  {
    name: "tadpole",
    cells: parseGrid([
      "                ",
      "                ",
      "    XXXX        ",
      "   XXXXXXX      ",
      "  XXXXXXXXX     ",
      "  XXXXXXXXXX    ",
      "  XXXXXXXXXX    ",
      "  XXXXXXXXX     ",
      "   XXXXXXX      ",
      "    XXXX        ",
      "                ",
      "                ",
    ]),
    anchors: { eye: [5, 5], mouth: [3, 6], tail: [12, 6], topFin: [5, 1], bottomFin: [5, 9] },
  },
  {
    name: "loaf",
    cells: parseGrid([
      "                ",
      "     XXXXXX     ",
      "    XXXXXXXX    ",
      "    XXXXXXXX    ",
      "    XXXXXXXX    ",
      "    XXXXXXXX    ",
      "    XXXXXXXX    ",
      "    XXXXXXXX    ",
      "    XXXXXXXX    ",
      "    XXXXXXXX    ",
      "     XXXXXX     ",
      "                ",
    ]),
    anchors: { eye: [5, 5], mouth: [4, 7], tail: [12, 6], topFin: [7, 0], bottomFin: [7, 11] },
  },
];

// ============================================================================
// TAILS — offsets relative to body.anchors.tail
// ============================================================================

export const TAILS: Part[] = [
  {
    name: "fan",
    cells: [
      [0, -2],
      [0, -1],
      [1, -1],
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [0, 2],
    ],
  },
  {
    name: "forked",
    cells: [
      [0, -3],
      [1, -3],
      [0, -2],
      [0, -1],
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 3],
    ],
  },
  {
    name: "whip",
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, -1],
    ],
  },
  {
    name: "sharp",
    cells: [
      [0, -2],
      [0, -1],
      [1, -1],
      [1, 0],
      [2, 0],
      [1, 1],
      [0, 1],
      [0, 2],
    ],
  },
  {
    name: "double-spike",
    cells: [
      [0, -2],
      [1, -2],
      [0, -1],
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
    ],
  },
  {
    name: "thin",
    cells: [
      [0, -1],
      [0, 0],
      [1, 0],
      [0, 1],
    ],
  },
];

// ============================================================================
// TOP FINS — offsets relative to body.anchors.topFin
// ============================================================================

export const TOP_FINS: Part[] = [
  { name: "none", cells: [] },
  {
    name: "spike",
    cells: [
      [0, 0],
      [-1, 0],
      [1, 0],
      [0, 1],
    ],
  },
  {
    name: "sail",
    cells: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 2],
      [3, 2],
    ],
  },
  {
    name: "multi-spike",
    cells: [
      [-2, 1],
      [-1, 0],
      [0, 1],
      [1, 0],
      [2, 1],
    ],
  },
  {
    name: "ridge",
    cells: [
      [-2, 1],
      [-1, 1],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
  },
];

// ============================================================================
// BOTTOM FINS — offsets relative to body.anchors.bottomFin
// ============================================================================

export const BOT_FINS: Part[] = [
  { name: "none", cells: [] },
  {
    name: "small",
    cells: [
      [0, 0],
      [-1, 0],
      [0, -1],
    ],
  },
  {
    name: "wide",
    cells: [
      [0, 0],
      [-1, 0],
      [1, 0],
      [-1, -1],
      [0, -1],
      [-2, 1],
    ],
  },
  {
    name: "paired",
    cells: [
      [-2, 0],
      [-1, 0],
      [1, 0],
      [2, 0],
    ],
  },
];

// ============================================================================
// EYES — 2x2 sprites placed at body.anchors.eye
// ============================================================================

export const EYES: Eye[] = [
  { name: "classic", sprite: ["WW", "WP"] },
  { name: "big", sprite: ["WW", "PP"] },
  { name: "shiny", sprite: ["WS", "WP"] },
  { name: "angry", sprite: ["PP", "WW"] },
  { name: "sleepy", sprite: ["..", "PP"] },
  { name: "cross", sprite: ["PW", "WP"] },
];

// ============================================================================
// MOUTHS — offsets relative to body.anchors.mouth
// ============================================================================

export const MOUTHS: Part[] = [
  { name: "closed", cells: [] },
  { name: "dot", cells: [[0, 0]] },
  {
    name: "underbite",
    cells: [
      [0, 0],
      [0, 1],
    ],
  },
  {
    name: "open",
    cells: [
      [0, 0],
      [-1, 0],
    ],
  },
  {
    name: "fangs",
    cells: [
      [0, 0],
      [-1, 1],
    ],
  },
];

// ============================================================================
// PATTERNS — selectors for secondary-color cells inside the body
// ============================================================================

export const PATTERNS: PatternName[] = [
  "solid",
  "vstripes",
  "hstripes",
  "spots",
  "speckle",
  "edge-dark",
  "underbelly",
  "chevron",
  "scales",
  "dotted",
];

// ============================================================================
// PALETTES — [primary, secondary, fin]
// ============================================================================

export const PALETTES: Palette[] = [
  ["#A78BFA", "#5EEAF0", "#9061F9"], // neon-purple
  ["#14F195", "#0FBC7C", "#FFB347"], // solana-green
  ["#5EEAF0", "#A78BFA", "#7DD3FC"], // electric-blue
  ["#FF4D6D", "#FFB347", "#FF8FA3"], // hot-pink
  ["#FFB347", "#FF4D6D", "#FFE066"], // sunset
  ["#F472B6", "#FBBF24", "#F9A8D4"], // magenta-gold
  ["#34D399", "#06B6D4", "#A7F3D0"], // mint-cyan
  ["#FBBF24", "#F59E0B", "#FCD34D"], // gold
  ["#9CA3AF", "#E5E7EB", "#D1D5DB"], // silver
  ["#EF4444", "#7F1D1D", "#FCA5A5"], // crimson
  ["#F97316", "#7C2D12", "#FED7AA"], // magma
  ["#60A5FA", "#1E3A8A", "#93C5FD"], // deep-ocean
  ["#A3A3A3", "#1f1f23", "#525252"], // void
  ["#06B6D4", "#FF00FF", "#FFE066"], // retro-cga
];

// ============================================================================
// BACKGROUNDS — CSS values for the tile fill
// ============================================================================

export const BACKGROUNDS: string[] = [
  "#0a0a0a",
  "radial-gradient(circle at 30% 30%, #1e1b4b 0%, #0a0a0a 75%)",
  "radial-gradient(circle at 60% 40%, #064e3b 0%, #0a0a0a 75%)",
  "radial-gradient(circle at 50% 50%, #1e3a8a 0%, #050505 75%)",
  "radial-gradient(circle at 30% 70%, #3f1d38 0%, #0a0a0a 75%)",
  "radial-gradient(circle at 70% 30%, #422006 0%, #0a0a0a 75%)",
  "radial-gradient(circle at 50% 80%, #134e4a 0%, #0a0a0a 75%)",
  "linear-gradient(135deg, #18181b 0%, #0a0a0a 100%)",
  "linear-gradient(180deg, #0c0a1a 0%, #050505 100%)",
  "#000000",
];
