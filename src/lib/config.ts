/**
 * Demo mode serves the design's market fixtures (balances, prices, activity) and
 * simulates broadcasting instead of sending real transactions. Key generation,
 * encryption, unlock and address derivation are always real.
 *
 * Set `EXPO_PUBLIC_DEMO_MODE=false` to broadcast real transactions via RPC.
 */
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE !== 'false';

/** Lock the wallet after the app has been in the background this long. */
export const AUTO_LOCK_MS = 60_000;

/** TODO: replace with the final legal document URLs from Swissquote Legal. */
export const LEGAL_URLS = {
  terms: 'https://www.swissquote.com/en/private/legal-information',
  privacy: 'https://www.swissquote.com/en/private/privacy-policy',
} as const;
