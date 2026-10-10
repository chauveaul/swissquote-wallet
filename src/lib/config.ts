/**
 * Demo mode serves the design's market fixtures (balances, prices, activity) and
 * simulates broadcasting instead of sending real transactions. Key generation,
 * encryption, unlock and address derivation are always real.
 *
 * Set `EXPO_PUBLIC_DEMO_MODE=false` to broadcast real transactions via RPC.
 */
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE !== 'false';

/**
 * Price source, independent of DEMO_MODE so prices can be live while balances
 * are still demo:
 * - `swissquote` (default): Swissquote's own real-time quotes for every listed
 *   crypto, daily history and FX;
 * - `kraken`: Kraken public market data (intraday history; 4 wallet tokens only);
 * - `demo`: the design's fixed sample prices, only when explicitly requested.
 */
export type MarketDataSourceId = 'swissquote' | 'kraken' | 'demo';
export const MARKET_DATA: MarketDataSourceId =
  (['kraken', 'demo'] as const).find((id) => id === process.env.EXPO_PUBLIC_MARKET_DATA) ?? 'swissquote';

/** TODO: replace with the final legal document URLs from Swissquote Legal. */
export const LEGAL_URLS = {
  terms: 'https://www.swissquote.com/en/private/legal-information',
  privacy: 'https://www.swissquote.com/en/private/privacy-policy',
} as const;

/** TODO: replace with the final support contacts from Swissquote. */
export const SUPPORT_URLS = {
  help: 'https://www.swissquote.com/en/private/contact',
  security: 'mailto:security@swissquote.ch',
} as const;
