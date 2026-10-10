import { convertCandles } from '@/features/market/series';
import { krakenSource } from '@/features/market/sources/kraken';
import { parseOhlc, parseTicker } from '@/services/kraken/krakenApi';
import { MarketDataError } from '@/services/marketData';

// Real responses recorded from Kraken's public API, 10 Oct 2026.
import ohlcEth from './fixtures/kraken-ohlc-eth-chf-60.json';
import ticker from './fixtures/kraken-ticker.json';

const respond = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: async () => body } as Response);

afterEach(() => jest.restoreAllMocks());

describe('Kraken responses', () => {
  it('parses tickers and candles', () => {
    const t = parseTicker(ticker, ['ETH/CHF', 'USD/CHF']);
    expect(t.get('ETH/CHF')).toEqual({ last: 2081.5, open: 2069.01 });
    const candles = parseOhlc(ohlcEth, 'ETH/CHF');
    expect(candles).toHaveLength(6);
    expect(candles[0]!.time % 1000).toBe(0);
    expect(candles.every((c) => c.close > 0)).toBe(true);
  });

  it('fails closed on errors, missing pairs and bad numbers', () => {
    expect(() => parseTicker({ error: ['EQuery:Unknown asset pair'] }, ['X/Y'])).toThrow(/Unknown asset pair/);
    expect(() => parseTicker(ticker, ['DOGE/CHF'])).toThrow(MarketDataError);
    expect(() => parseTicker({ error: [], result: { 'ETH/CHF': { c: ['abc'], o: '1' } } }, ['ETH/CHF'])).toThrow(
      /Malformed price/,
    );
    expect(() => parseOhlc({ error: [], result: {} }, 'ETH/CHF')).toThrow(/no candles/);
  });
});

describe('Kraken market data source', () => {
  it('gets all quotes and FX in a single request, converting USD-quoted tokens to CHF', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(() => respond(ticker));
    const snap = await krakenSource.snapshot(['ETH', 'WBTC', 'USDC', 'LINK']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/0/public/Ticker?pair=');

    expect(snap.quotes.ETH!.price).toBe(2081.5);
    expect(snap.quotes.USDC!.price).toBeCloseTo(0.8304);
    // WBTC/USD 82'889.2 × USD/CHF 0.83031 ≈ CHF 68'823, in line with BTC/CHF 68'876.8.
    expect(snap.quotes.WBTC!.price).toBeCloseTo(82889.2 * 0.83031, 2);
    expect(snap.quotes.ETH!.change24hPct!).toBeCloseTo(((2081.5 - 2069.01) / 2069.01) * 100, 6);

    expect(snap.fxPerChf!.CHF).toBe(1);
    expect(snap.fxPerChf!.EUR).toBeCloseTo(1 / 0.92942, 6);
    expect(snap.fxPerChf!.USD).toBeCloseTo(1 / 0.83031, 6);
    expect(snap.fxPerChf!.GBP).toBeCloseTo(1 / (1.32235 * 0.83031), 6);
  });

  it('builds chart points from candles', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(() => respond(ohlcEth));
    const points = await krakenSource.history('ETH', '1W');
    expect(points).toHaveLength(6);
    expect(points.at(-1)!.value).toBe(Number(ohlcEth.result['ETH/CHF'].at(-1)![4]));
  });

  it('reports a failed request instead of returning prices', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(() => respond({}, 503));
    await expect(krakenSource.snapshot(['ETH'])).rejects.toThrow('Kraken responded 503');
  });
});

describe('convertCandles', () => {
  it('uses the FX rate in force at each candle time', () => {
    const c = (time: number, close: number) => ({ time, open: close, high: close, low: close, close });
    const out = convertCandles([c(10, 100), c(20, 100), c(30, 100)], [c(0, 0.9), c(25, 0.8)]);
    expect(out.map((x) => x.close)).toEqual([90, 90, 80]);
    expect(convertCandles([c(10, 100)], [])).toEqual([]);
  });
});
