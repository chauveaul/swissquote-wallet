import { downsample, rangeStart, toPricePoints, toQuote } from '@/features/market/series';
import { MarketDataError, parseCandleResponse } from '@/services/swissquote/chartApi';

// Trimmed real response from Swissquote's chart service (SMI, CH0009980894), 10 Oct 2026.
import recorded from './fixtures/swissquote-histo-smi.json';

describe('Swissquote chart response', () => {
  it('parses the recorded response into sorted candles', () => {
    const s = parseCandleResponse(recorded);
    expect(s.previousClose).toBe(13637);
    expect(s.candles).toHaveLength(8);
    expect(s.candles.at(-1)).toMatchObject({ close: 13787.4, time: Date.parse('2026-10-09T15:30:13Z') });
    expect(s.candles.every((c, i, a) => i === 0 || a[i - 1]!.time <= c.time)).toBe(true);
  });

  it('fails closed on error bodies and malformed data', () => {
    expect(() => parseCandleResponse({ errorCode: 'INTERNAL', message: 'x' })).toThrow(MarketDataError);
    expect(() => parseCandleResponse({ productInfo: 'nope' })).toThrow(MarketDataError);
    expect(() =>
      parseCandleResponse({ productInfo: [{ open: 1, high: 1, low: 1, close: 'x', time: '2026-01-01T00:00:00Z' }] }),
    ).toThrow(MarketDataError);
    expect(() =>
      parseCandleResponse({ productInfo: [{ open: 1, high: 1, low: 1, close: 0, time: '2026-01-01T00:00:00Z' }] }),
    ).toThrow(/Non-positive/);
    expect(parseCandleResponse({ productInfo: [] }).candles).toEqual([]);
  });
});

describe('series helpers', () => {
  const now = Date.parse('2026-10-10T12:00:00Z');

  it('maps chart ranges to request start dates', () => {
    expect(rangeStart('1W', now).toISOString().slice(0, 10)).toBe('2026-10-03');
    expect(rangeStart('1Y', now).toISOString().slice(0, 10)).toBe('2025-10-10');
    expect(rangeStart('ALL', now).toISOString().slice(0, 10)).toBe('1926-10-10');
  });

  it('computes the quote and daily change from the previous close', () => {
    const q = toQuote(parseCandleResponse(recorded))!;
    expect(q.price).toBe(13787.4);
    expect(q.change24hPct!.toFixed(2)).toBe('1.10'); // (13787.4 − 13637) / 13637
    expect(toQuote({ previousClose: null, candles: [] })).toBeNull();
  });

  it('downsamples long series but keeps endpoints and extremes', () => {
    const candles = Array.from({ length: 5000 }, (_, i) => ({
      time: i * 86_400_000,
      open: 1,
      high: 1,
      low: 1,
      close: i === 2500 ? 999 : i === 3000 ? 0.5 : 10 + Math.sin(i / 50),
    }));
    const out = downsample(candles);
    expect(out.length).toBeLessThanOrEqual(120);
    expect(out[0]).toBe(candles[0]);
    expect(out.at(-1)).toBe(candles.at(-1));
    expect(out.some((c) => c.close === 999)).toBe(true);
    expect(out.some((c) => c.close === 0.5)).toBe(true);
    expect(downsample(candles.slice(0, 50))).toHaveLength(50);
  });

  it('labels daily points by date and shows previous close → latest for 1D', () => {
    const s = parseCandleResponse(recorded);
    const oneDay = toPricePoints(s, '1D', { dailyOnly: true });
    expect(oneDay.map((p) => p.value)).toEqual([13637, 13787.4]);
    expect(toPricePoints(s, '1M')[0]!.label).toMatch(/^\d{1,2} [A-Z][a-z]{2}$/);
  });
});
