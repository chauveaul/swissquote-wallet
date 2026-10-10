/**
 * Demo mode serves the design's market fixtures (balances, prices, activity) and
 * simulates broadcasting instead of sending real transactions. Key generation,
 * encryption, unlock and address derivation are always real.
 *
 * Live mode is the default in this checkout: it reads real balances, prices
 * and fees and broadcasts real transactions via RPC. Set
 * `EXPO_PUBLIC_DEMO_MODE=true` to fall back to the fixtures.
 */
export const DEMO_MODE = (process.env.EXPO_PUBLIC_DEMO_MODE ?? 'false') === 'true';

/** Lock the wallet after the app has been in the background this long. */
export const AUTO_LOCK_MS = 60_000;

/** TODO: replace with the final legal document URLs from Swissquote Legal. */
export const LEGAL_URLS = {
  terms: 'https://www.swissquote.com/en/private/legal-information',
  privacy: 'https://www.swissquote.com/en/private/privacy-policy',
} as const;
