import { CRYPTO_CATALOG, catalogEntry, isWalletToken } from '@/features/market/catalog';
import { demoPortfolio } from '@/features/market/fixtures';
import { valuePortfolio } from '@/features/market/queries';
import { cryptoInstrument, FX_INSTRUMENTS, swissquoteSource } from '@/features/market/sources/swissquote';
import { MarketDataError } from '@/services/marketData';
import { parseFullQuotes } from '@/services/swissquote/quoteApi';

// Real responses recorded from Swissquote's market-quote and chart services, 10 Oct 2026.
import batch from './fixtures/swissquote-fullquote-batch.json';
import histoEth from './fixtures/swissquote-histo-eth.json';
import histoUsdChf from './fixtures/swissquote-histo-usdchf.json';

const respond = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: async () => body } as Response);

afterEach(() => jest.restoreAllMocks());

const USD_CHF = 0.83015;

describe('crypto catalog', () => {
  it('lists every Swissquote crypto once, with valid identifiers', () => {
    expect(CRYPTO_CATALOG.length).toBe(55);
    expect(new Set(CRYPTO_CATALOG.map((a) => a.symbol)).size).toBe(55);
    expect(CRYPTO_CATALOG.every((a) => /^EX0X00[A-Z]{3}000$/.test(a.isin))).toBe(true);
    expect(catalogEntry('ETH')?.isin).toBe('EX0X00ETH000');
    expect(catalogEntry('LINK')?.isin).toBe('EX0X00LNK000');
    // WBTC isn't listed by Swissquote; it is 1:1 BTC-backed and priced as BTC.
    expect(catalogEntry('WBTC')?.isin).toBe('EX0X00XBT000');
    expect(isWalletToken('ETH')).toBe(true);
    expect(isWalletToken('SOL')).toBe(false);
  });
});

describe('Swissquote quote response', () => {
  it('parses quotes and treats missing prices as unavailable', () => {
    const book = parseFullQuotes(batch);
    expect(book.size).toBe(8);
    const eth = [...book.values()].find((q) => q.symbol === 'ETH')!;
    expect(eth).toMatchObject({ last: 2508.7, netChange: 23.5, serviceLevel: 'REALTIME', productType: 'DIGITAL_ASSET' });
    const eurc = [...book.values()].find((q) => q.symbol === 'EURC')!;
    expect(eurc.last).toBeNull();
  });

  it('fails closed on error bodies and malformed entries', () => {
    expect(() => parseFullQuotes({ message: 'Invalid payload exception' })).toThrow(/Invalid payload/);
    expect(() => parseFullQuotes([['x']])).toThrow(MarketDataError);
  });
});

describe('Swissquote market data source', () => {
  it('gets quotes and FX in one request and converts USD to CHF with Swissquote’s rate', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(() => respond(batch));
    const snap = await swissquoteSource.snapshot(['ETH', 'WBTC', 'USDC', 'LINK', 'EURC', 'NOPE']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/web-market-quote\/api\/fullquote\/batch$/);
    const sent = JSON.parse(String(init!.body)) as { isin: string }[];
    expect(sent.map((k) => k.isin)).toEqual(
      expect.arrayContaining(['EX0X00ETH000', 'EX0X00XBT000', 'CCXUSDXCHFXX', 'CCXEURXCHFXX', 'CCXGBPXCHFXX']),
    );
    // WBTC and BTC share an instrument: requested once.
    expect(sent.filter((k) => k.isin === 'EX0X00XBT000')).toHaveLength(1);

    expect(snap.quotes.ETH!.price).toBeCloseTo(2508.7 * USD_CHF, 6);
    expect(snap.quotes.WBTC!.price).toBeCloseTo(82958 * USD_CHF, 6);
    expect(snap.quotes.USDC!.price).toBeCloseTo(USD_CHF, 6);
    // Change vs previous close in CHF, including the FX move.
    const prevChf = (2508.7 - 23.5) * (USD_CHF - 5e-6);
    expect(snap.quotes.ETH!.change24hPct!).toBeCloseTo(((2508.7 * USD_CHF - prevChf) / prevChf) * 100, 6);
    // No price, no quote: never a guess.
    expect(snap.quotes.EURC).toBeUndefined();
    expect(snap.quotes.NOPE).toBeUndefined();

    expect(snap.fxPerChf).toMatchObject({ CHF: 1, USD: 1 / USD_CHF, EUR: 1 / 0.92992, GBP: 1 / 1.0985 });
  });

  it('shows no crypto prices when the USD/CHF rate is missing', async () => {
    const withoutUsd = (batch as unknown[]).filter((e) => (e as [{ isin: string }])[0].isin !== 'CCXUSDXCHFXX');
    jest.spyOn(globalThis, 'fetch').mockImplementation(() => respond(withoutUsd));
    const snap = await swissquoteSource.snapshot(['ETH']);
    expect(snap.quotes).toEqual({});
    expect(snap.fxPerChf!.USD).toBeUndefined();
  });

  it('builds CHF chart history from the asset and USD/CHF candles', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation((_url, init) =>
      respond(String(init?.body).includes('CCXUSDXCHFXX') ? histoUsdChf : histoEth),
    );
    const points = await swissquoteSource.history('ETH', '1M');
    expect(points.length).toBe(histoEth.productInfo.length);
    expect(points.at(-1)!.value).toBeCloseTo(2508.7 * USD_CHF, 6);
  });

  it('reports failures instead of returning prices', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(() => respond({}, 500));
    await expect(swissquoteSource.snapshot(['ETH'])).rejects.toThrow('Quote service responded 500');
    expect(cryptoInstrument('NOPE')).toBeUndefined();
    await expect(swissquoteSource.history('NOPE', '1M')).resolves.toEqual([]);
    expect(FX_INSTRUMENTS.USD.isin).toBe('CCXUSDXCHFXX');
  });
});

describe('portfolio valuation', () => {
  it('values holdings at live prices and marks unpriced tokens instead of zeroing them silently', () => {
    const quotes = new Map([['ETH', { price: 3000, change24hPct: 2, updatedAt: 0 }]] as const);
    const p = valuePortfolio(demoPortfolio, new Map(quotes));
    const eth = p.tokens.find((t) => t.symbol === 'ETH')!;
    expect(eth.valueChf).toBeCloseTo(2.412 * 3000);
    expect(eth.priceAvailable).toBe(true);
    expect(p.tokens.filter((t) => t.priceAvailable === false).map((t) => t.symbol)).toEqual(['WBTC', 'USDC', 'LINK']);
    expect(p.totalChf).toBeCloseTo(7236);
    expect(p.changeTodayPct).toBeCloseTo(2);
  });
});
