/**
 * Demo mode serves the design's market fixtures (balances, prices, activity) and
 * simulates broadcasting instead of sending real transactions. Key generation,
 * encryption, unlock and address derivation are always real.
 *
 * Set `EXPO_PUBLIC_DEMO_MODE=false` to broadcast real transactions via RPC.
 */
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE !== 'false';

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
