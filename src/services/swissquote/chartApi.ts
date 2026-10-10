import { fetchWithTimeout, MarketDataError, type Candle, type CandleSeries } from '../marketData';

/**
 * Client for Swissquote's chart price service (the endpoint behind the charts
 * on swissquote.ch).
 *
 * NOTE: this is an internal endpoint without a published contract. Everything
 * about its shape lives in this file, responses are validated and anything
 * unexpected throws rather than producing a wrong price. Before release, agree
 * the contract (parameters, auth, limits) with the owning Swissquote team.
 */

export type Instrument = {
  isin: string;
  /** Swissquote exchange id, e.g. -9 for the SMI. */
  exchangeId: number;
  /** Listing currency; selects the listing, it does not convert. */
  currency: string;
};

export { MarketDataError };
export type { Candle, CandleSeries };

const TIMEOUT_MS = 8_000;
const PATH = '/securities-retail-chart-plugin/api/chart/trading-view/histo';

/** Native apps call Swissquote directly; the web preview goes through the dev proxy (no CORS). */
export function apiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_SWISSQUOTE_API_URL;
  if (configured) return configured.replace(/\/$/, '');
  return typeof document !== 'undefined' ? '/sq-api' : 'https://www.swissquote.ch';
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Validates and normalizes one raw response. Exported for tests. */
export function parseCandleResponse(raw: unknown): CandleSeries {
  if (!raw || typeof raw !== 'object') throw new MarketDataError('Empty price response.');
  const body = raw as { productInfo?: unknown; previousClosePrice?: unknown; errorCode?: unknown };
  if (body.errorCode) throw new MarketDataError(`Price service error: ${String(body.errorCode)}`);
  if (!Array.isArray(body.productInfo)) throw new MarketDataError('Malformed price response.');

  const candles: Candle[] = [];
  for (const c of body.productInfo as Record<string, unknown>[]) {
    const time = typeof c?.time === 'string' ? Date.parse(c.time) : NaN;
    if (!Number.isFinite(time) || !isNum(c.open) || !isNum(c.high) || !isNum(c.low) || !isNum(c.close)) {
      throw new MarketDataError('Malformed candle in price response.');
    }
    if (c.close <= 0) throw new MarketDataError('Non-positive price in response.');
    candles.push({ time, open: c.open, high: c.high, low: c.low, close: c.close });
  }
  candles.sort((a, b) => a.time - b.time);
  return { previousClose: isNum(body.previousClosePrice) ? body.previousClosePrice : null, candles };
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Daily candles (the last one intraday) between two dates, inclusive. */
export async function fetchCandles(
  instrument: Instrument,
  from: Date,
  to: Date,
  { signal }: { signal?: AbortSignal } = {},
): Promise<CandleSeries> {
  const url = `${apiBaseUrl()}${PATH}?from=${ymd(from)}&to=${ymd(to)}&countBack=-1`;
  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(instrument),
      signal,
    },
    TIMEOUT_MS,
    'Price service',
  );
  return parseCandleResponse(await res.json());
}
