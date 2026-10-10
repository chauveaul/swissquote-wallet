/**
 * Kraken public market-data API (https://docs.kraken.com/api/). Public,
 * documented, no key; CORS-enabled, so the web preview needs no proxy.
 *
 * Production use of exchange data in a bank app needs a market-data licence
 * from the provider. Everything provider-specific stays in this file; responses
 * are validated and anything unexpected throws instead of producing a price.
 */
import { fetchWithTimeout, MarketDataError, type Candle } from '../marketData';

const BASE = 'https://api.kraken.com/0/public';
const TIMEOUT_MS = 8_000;

export type Ticker = {
  /** Last trade price. */
  last: number;
  /** Today's opening price (00:00 UTC), used for the daily change. */
  open: number;
};

/** Supported candle widths in minutes. */
export type OhlcInterval = 1 | 5 | 15 | 30 | 60 | 240 | 1440 | 10080 | 21600;

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0) throw new MarketDataError('Malformed price in Kraken response.');
  return n;
};

function unwrap(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') throw new MarketDataError('Empty Kraken response.');
  const body = raw as { error?: unknown; result?: unknown };
  if (Array.isArray(body.error) && body.error.length) {
    throw new MarketDataError(`Kraken error: ${body.error.join(', ')}`);
  }
  if (!body.result || typeof body.result !== 'object') throw new MarketDataError('Malformed Kraken response.');
  return body.result as Record<string, unknown>;
}

/** Validates a Ticker response. Exported for tests. */
export function parseTicker(raw: unknown, pairs: readonly string[]): Map<string, Ticker> {
  const result = unwrap(raw);
  const out = new Map<string, Ticker>();
  for (const pair of pairs) {
    const t = result[pair] as { c?: unknown[]; o?: unknown } | undefined;
    if (!t) throw new MarketDataError(`Kraken returned no ticker for ${pair}.`);
    out.set(pair, { last: num(t.c?.[0]), open: num(t.o) });
  }
  return out;
}

/** Validates an OHLC response. Exported for tests. */
export function parseOhlc(raw: unknown, pair: string): Candle[] {
  const rows = unwrap(raw)[pair];
  if (!Array.isArray(rows)) throw new MarketDataError(`Kraken returned no candles for ${pair}.`);
  return rows.map((r) => {
    if (!Array.isArray(r) || typeof r[0] !== 'number') throw new MarketDataError('Malformed candle in Kraken response.');
    return { time: r[0] * 1000, open: num(r[1]), high: num(r[2]), low: num(r[3]), close: num(r[4]) };
  });
}

/** Latest ticker for several pairs (e.g. "ETH/CHF") in one request. */
export async function fetchTickers(pairs: readonly string[], signal?: AbortSignal): Promise<Map<string, Ticker>> {
  const url = `${BASE}/Ticker?pair=${pairs.map(encodeURIComponent).join(',')}`;
  const res = await fetchWithTimeout(url, { signal }, TIMEOUT_MS, 'Kraken');
  return parseTicker(await res.json(), pairs);
}

/** Candles (max 720) of `interval` minutes since `since` for one pair. */
export async function fetchOhlc(
  pair: string,
  interval: OhlcInterval,
  since: Date,
  signal?: AbortSignal,
): Promise<Candle[]> {
  const url = `${BASE}/OHLC?pair=${encodeURIComponent(pair)}&interval=${interval}&since=${Math.floor(since.getTime() / 1000)}`;
  const res = await fetchWithTimeout(url, { signal }, TIMEOUT_MS, 'Kraken');
  return parseOhlc(await res.json(), pair);
}
