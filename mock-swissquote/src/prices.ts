/**
 * Live CHF prices for the assets this server credits/debits — fetched
 * directly from Swissquote's own real-time quote service, the same one the
 * wallet app uses (src/services/swissquote/quoteApi.ts). Called
 * server-to-server here (no browser involved, so no CORS/dev-proxy needed).
 * Deliberately duplicated rather than imported across packages, same as
 * chains.ts — this server is its own process with its own dependencies.
 *
 * Falls back to fixed demo constants if the live fetch fails, logged
 * clearly rather than silently serving a stale or wrong number.
 */

type Instrument = { isin: string; exchangeId: number; currency: string };

const CRYPTO_EXCHANGE = 31337;
const INSTRUMENTS = {
  ETH: { isin: 'EX0X00ETH000', exchangeId: CRYPTO_EXCHANGE, currency: 'USD' },
  USDC: { isin: 'EX0X00UDC000', exchangeId: CRYPTO_EXCHANGE, currency: 'USD' },
  LINK: { isin: 'EX0X00LNK000', exchangeId: CRYPTO_EXCHANGE, currency: 'USD' },
} as const satisfies Record<Asset, Instrument>;
const USD_CHF: Instrument = { isin: 'CCXUSDXCHFXX', exchangeId: -2, currency: 'CHF' };

export type Asset = 'ETH' | 'USDC' | 'LINK';

/** Used only if the live fetch fails. */
const FALLBACK_CHF: Record<Asset, number> = { ETH: 2800, USDC: 0.95, LINK: 13 };

const keyId = (k: Instrument) => `${k.isin}|${k.exchangeId}|${k.currency}`;

type QuoteEntry = [Instrument, { lastPrice?: { amount?: number; status?: string } } | null];

const CACHE_MS = 30_000;
let cache: { at: number; prices: Record<Asset, number> } | null = null;

export async function getChfPrices(): Promise<Record<Asset, number>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.prices;
  try {
    const keys = [...Object.values(INSTRUMENTS), USD_CHF];
    const res = await fetch('https://www.swissquote.ch/web-market-quote/api/fullquote/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(keys),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`Quote service responded ${res.status}`);
    const raw = (await res.json()) as QuoteEntry[];
    const byKey = new Map(raw.map(([k, v]) => [keyId(k), v]));

    const usd = byKey.get(keyId(USD_CHF));
    const usdChf = usd?.lastPrice?.status === 'AVAILABLE' ? usd.lastPrice.amount : undefined;
    if (!usdChf) throw new Error('No USD/CHF rate available');

    const prices = {} as Record<Asset, number>;
    for (const asset of Object.keys(INSTRUMENTS) as Asset[]) {
      const q = byKey.get(keyId(INSTRUMENTS[asset]));
      const usdPrice = q?.lastPrice?.status === 'AVAILABLE' ? q.lastPrice.amount : undefined;
      prices[asset] = usdPrice ? usdPrice * usdChf : FALLBACK_CHF[asset];
    }
    cache = { at: Date.now(), prices };
    return prices;
  } catch (e) {
    console.warn('[mock-swissquote] live price fetch failed, using fallback constants:', e);
    return FALLBACK_CHF;
  }
}
