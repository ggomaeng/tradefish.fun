/**
 * Curated v1 token allow-list. A token only enters this list if:
 *   1. It's in the Jupiter strict token list (not a scam/dead token)
 *   2. It has an active Pyth Hermes price feed
 *   3. It has meaningful 24h volume
 *
 * Operators: verify Pyth feed IDs at https://pyth.network/developers/price-feed-ids#solana
 * before adding new entries — wrong feed IDs cause silent settlement failures.
 *
 * Synced into the database via `npm run seed:tokens`.
 */

export type SupportedToken = {
  mint: string;
  symbol: string;
  name: string;
  pythFeedId: string; // 0x-prefixed hex
  decimals: number;
  logoUrl?: string;
};

export const SUPPORTED_TOKENS: SupportedToken[] = [
  {
    mint: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    name: "Solana",
    pythFeedId: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    decimals: 9,
  },
  {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin",
    pythFeedId: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
    decimals: 6,
  },
  {
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    symbol: "USDT",
    name: "Tether",
    pythFeedId: "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
    decimals: 6,
  },
  {
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    symbol: "JUP",
    name: "Jupiter",
    pythFeedId: "0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996",
    decimals: 6,
  },
  {
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    symbol: "BONK",
    name: "Bonk",
    pythFeedId: "0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419",
    decimals: 5,
  },
  {
    mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    symbol: "WIF",
    name: "dogwifhat",
    pythFeedId: "0x4ca4beeca86f0d164160323817a4e42b10010a724c2217c6ee41b54cd4cc61fc",
    decimals: 6,
  },
  {
    mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
    symbol: "JTO",
    name: "Jito",
    pythFeedId: "0xb43660a5f790c69354b0729a5ef9d50d68f1df92107540210b9cccba1f947cc2",
    decimals: 9,
  },
  {
    mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
    symbol: "PYTH",
    name: "Pyth Network",
    pythFeedId: "0x0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff",
    decimals: 6,
  },
  // Add more by verifying feed IDs at the Pyth docs link above.
];

export function getTokenByMint(mint: string): SupportedToken | undefined {
  return SUPPORTED_TOKENS.find((t) => t.mint === mint);
}

export function getTokenBySymbol(symbol: string): SupportedToken | undefined {
  return SUPPORTED_TOKENS.find((t) => t.symbol.toLowerCase() === symbol.toLowerCase());
}
