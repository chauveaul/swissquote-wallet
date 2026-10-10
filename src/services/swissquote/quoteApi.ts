import { fetchWithTimeout, MarketDataError } from '../marketData';
import { apiBaseUrl, type Instrument } from './chartApi';

/**
 * Client for Swissquote's market-quote service: latest quotes for up to ~60
 * instruments in one request (crypto, FX, securities).
 *
 * Internal endpoint without a published contract: its shape is validated here
 * and anything unexpected throws rather than producing a price.
 */

const PATH = '/web-market-quote/api/fullquote/batch';
const TIMEOUT_MS = 8_000;

export type FullQuote = {
  key: Instrument;
  symbol: string;
  name: string;
  productType: string;
  /** "REALTIME" or "DELAY". */
  serviceLevel: string;
  marketStatus: string;
  /** Last price in the listing currency; null when Swissquote has none. */
  last: number | null;
  /** Change since the previous close, in listing currency. */
  netChange: number | null;
  timestamp: number | null;
};

const keyId = (k: Instrument) => `${k.isin}|${k.exchangeId}|${k.currency}`;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Validates a batch response, keyed like the request. Exported for tests. */
export function parseFullQuotes(raw: unknown): Map<string, FullQuote> {
  if (!Array.isArray(raw)) {
    const message = raw && typeof raw === 'object' ? (raw as { message?: unknown }).message : undefined;
    throw new MarketDataError(message ? `Quote service: ${String(message)}` : 'Malformed quote response.');
  }
  const out = new Map<string, FullQuote>();
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length !== 2) throw new MarketDataError('Malformed quote entry.');
    const [key, q] = entry as [Instrument, Record<string, unknown> | null];
    if (!key || typeof key.isin !== 'string') throw new MarketDataError('Malformed quote key.');
    if (!q) continue; // unknown instrument
    const lp = (q.lastPrice ?? {}) as { amount?: unknown; timestamp?: unknown; status?: unknown };
    const available = lp.status === 'AVAILABLE' && isNum(lp.amount) && lp.amount > 0;
    const ts = typeof lp.timestamp === 'string' ? Date.parse(lp.timestamp) : NaN;
    out.set(keyId(key), {
      key,
      symbol: String(q.symbol ?? ''),
      name: String(q.productName ?? ''),
      productType: String(q.productType ?? ''),
      serviceLevel: String(q.serviceLevel ?? ''),
      marketStatus: String(q.marketStatus ?? ''),
      last: available ? (lp.amount as number) : null,
      netChange: available && isNum(q.netChange) ? q.netChange : null,
      timestamp: Number.isFinite(ts) ? ts : null,
    });
  }
  return out;
}

/** Latest quotes for many instruments in one request. */
export async function fetchFullQuotes(keys: readonly Instrument[], signal?: AbortSignal) {
  const res = await fetchWithTimeout(
    `${apiBaseUrl()}${PATH}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(keys),
      signal,
    },
    TIMEOUT_MS,
    'Quote service',
  );
  const quotes = parseFullQuotes(await res.json());
  return { get: (k: Instrument) => quotes.get(keyId(k)) ?? null, size: quotes.size };
}
