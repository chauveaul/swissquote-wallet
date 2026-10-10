import type { Candle, CandleSeries } from '@/services/marketData';

import { formatPointLabel } from './labels';
import type { PricePoint, PriceRange } from './types';

const DAY = 86_400_000;
export const MAX_CHART_POINTS = 120;

/** First date to request for a chart range. "ALL" matches what swissquote.ch requests. */
export function rangeStart(range: PriceRange, now: number): Date {
  switch (range) {
    case '1D':
      return new Date(now - 4 * DAY); // covers weekends; trimmed to the last two candles
    case '1W':
      return new Date(now - 7 * DAY);
    case '1M':
      return new Date(now - 30 * DAY);
    case '1Y':
      return new Date(now - 365 * DAY);
    case 'ALL':
      return new Date('1926-10-10T00:00:00Z');
  }
}

/**
 * Reduces a long series to at most `max` points while keeping its shape:
 * first, last and each bucket's min and max are preserved.
 */
export function downsample(candles: Candle[], max = MAX_CHART_POINTS): Candle[] {
  if (candles.length <= max) return candles;
  const buckets = Math.floor((max - 2) / 2);
  const inner = candles.slice(1, -1);
  const size = inner.length / buckets;
  const out: Candle[] = [candles[0]!];
  for (let b = 0; b < buckets; b++) {
    const slice = inner.slice(Math.floor(b * size), Math.floor((b + 1) * size));
    if (!slice.length) continue;
    let lo = slice[0]!;
    let hi = slice[0]!;
    for (const c of slice) {
      if (c.close < lo.close) lo = c;
      if (c.close > hi.close) hi = c;
    }
    out.push(...(lo.time <= hi.time ? [lo, hi] : [hi, lo]).filter((c, i, a) => a.indexOf(c) === i));
  }
  out.push(candles[candles.length - 1]!);
  return out;
}

/** Multiplies each candle by the FX close in force at that time (latest FX candle not after it). */
export function convertCandles(candles: Candle[], fx: Candle[]): Candle[] {
  if (!fx.length) return [];
  const sorted = [...fx].sort((a, b) => a.time - b.time);
  let j = 0;
  return candles.map((c) => {
    while (j + 1 < sorted.length && sorted[j + 1]!.time <= c.time) j++;
    const rate = sorted[j]!.close;
    return { time: c.time, open: c.open * rate, high: c.high * rate, low: c.low * rate, close: c.close * rate };
  });
}

const isMidnightUtc = (t: number) => t % DAY === 0;

/**
 * Chart points for a range. With a daily-only source (`dailyOnly`), 1D shows
 * previous close → latest; intraday sources plot the full day.
 */
export function toPricePoints(
  series: CandleSeries,
  range: PriceRange,
  { dailyOnly = false }: { dailyOnly?: boolean } = {},
): PricePoint[] {
  const candles = range === '1D' && dailyOnly ? series.candles.slice(-2) : downsample(series.candles);
  return candles.map((c) => ({
    value: c.close,
    label: formatPointLabel(range, new Date(c.time), isMidnightUtc(c.time)),
  }));
}

export type Quote = { price: number; change24hPct: number | null; updatedAt: number };

/** Latest price (last candle close) and change against the previous session close. */
export function toQuote(series: CandleSeries): Quote | null {
  const last = series.candles[series.candles.length - 1];
  if (!last) return null;
  const prev = series.previousClose ?? series.candles[series.candles.length - 2]?.close ?? null;
  return {
    price: last.close,
    change24hPct: prev ? ((last.close - prev) / prev) * 100 : null,
    updatedAt: last.time,
  };
}
