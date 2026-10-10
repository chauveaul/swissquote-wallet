import type { PricePoint, PriceRange } from './types';

/*
 * Real price history from Swissquote's chart API (their own product listing
 * for Ethereum, quoted in USD). `histo` serves daily candles for a date
 * window; `intraday` serves hourly candles for the last ~4.7 days
 * regardless of `from`.
 */

const BASE = 'https://www.swissquote.ch/securities-retail-chart-plugin/api/chart/trading-view';
const ETH = { isin: 'EX0X00ETH000', exchangeId: 31337, currency: 'USD' } as const;

type Candle = { high: number; low: number; open: number; close: number; time: string };
type SqResponse = { productInfo: Candle[] | null };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (x: number) => String(x).padStart(2, '0');

function fmtLabel(d: Date, range: PriceRange): string {
  if (range === '1D') return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (range === '1W') return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${pad(d.getHours())}:00`;
  if (range === '1M') return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function toISODate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Stride-downsamples so the SVG polyline stays cheap on long windows. */
function downsample(candles: Candle[], max: number): Candle[] {
  if (candles.length <= max) return candles;
  const stride = Math.ceil(candles.length / max);
  const out: Candle[] = [];
  for (let i = 0; i < candles.length; i += stride) out.push(candles[i]!);
  const last = candles[candles.length - 1]!;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

async function sqFetch(kind: 'histo' | 'intraday', from: string, to: string): Promise<Candle[]> {
  const res = await fetch(`${BASE}/${kind}?from=${from}&to=${to}&countBack=-1`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(ETH),
  });
  if (!res.ok) throw new Error(`Chart API responded ${res.status}`);
  const data = (await res.json()) as SqResponse;
  return data.productInfo ?? [];
}

export async function fetchEthPriceHistory(range: PriceRange): Promise<PricePoint[]> {
  const now = new Date();
  const to = toISODate(now);
  const daysAgo = (n: number) => toISODate(new Date(now.getTime() - n * 86_400_000));

  let candles: Candle[];
  if (range === '1D' || range === '1W') {
    candles = await sqFetch('intraday', daysAgo(range === '1D' ? 1 : 7), to);
    if (range === '1D') {
      const cutoff = now.getTime() - 86_400_000;
      const recent = candles.filter((c) => new Date(c.time).getTime() >= cutoff);
      if (recent.length > 1) candles = recent;
    }
  } else {
    const from = range === '1M' ? daysAgo(30) : range === '1Y' ? daysAgo(365) : '2015-08-07';
    candles = await sqFetch('histo', from, to);
  }

  const points = downsample(candles, 400).map((c) => {
    const d = new Date(c.time);
    return { value: c.close, label: fmtLabel(d, range) };
  });
  if (points.length < 2) throw new Error('Not enough price points');
  return points;
}
