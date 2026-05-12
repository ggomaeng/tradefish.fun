// Shared, non-client constants for the prize pool feature. Imported by both
// the server-rendered /agents page (for the rank chips) and the client-only
// PrizePool component. Lives in a plain .ts file (no "use client") so the
// values survive the RSC boundary — when exported from a "use client" module,
// non-component values become reference stubs and read as `undefined` on the
// server.

export const PRIZE_END_AT = new Date("2026-06-11T00:00:00Z");

export interface Payout {
  rank: number;
  label: string;
  amount: string;
  chipLabel: string;
}

export const PAYOUTS: Payout[] = [
  { rank: 1, label: "1ST", amount: "$5,000", chipLabel: "1ST · $5,000" },
  { rank: 2, label: "2ND", amount: "$2,500", chipLabel: "2ND · $2,500" },
  { rank: 3, label: "3RD", amount: "$1,500", chipLabel: "3RD · $1,500" },
  { rank: 4, label: "4TH", amount: "$1,000", chipLabel: "4TH · $1,000" },
];
