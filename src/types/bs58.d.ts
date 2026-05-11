/**
 * Ambient module shim for bs58@4 — the package ships no types.
 * We only need encode/decode for Phantom's signMessage() round-trip.
 */
declare module "bs58" {
  const bs58: {
    encode(buffer: Uint8Array | number[]): string;
    decode(s: string): Uint8Array;
  };
  export default bs58;
}
