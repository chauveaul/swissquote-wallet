import { allOrAbort, type Candle } from '@/services/marketData';
import { fetchCandles, type Instrument, type Resolution } from '@/services/swissquote/chartApi';
import { fetchFullQuotes } from '@/services/swissquote/quoteApi';

import { catalogEntry, SWISSQUOTE_CRYPTO_CURRENCY, SWISSQUOTE_CRYPTO_EXCHANGE } from '../catalog';
import { convertCandles, rangeStart, toPricePoints } from '../series';
import type { MarketDataSource, MarketSnapshot } from './types';

const DAY = 86_400_000;

/** Swissquote's own FX rates (real-time), all quoted in CHF. */
export const FX_INSTRUMENTS = {
  USD: { isin: 'CCXUSDXCHFXX', exchangeId: -2, currency: 'CHF' },
  EUR: { isin: 'CCXEURXCHFXX', exchangeId: -2, currency: 'CHF' },
  GBP: { isin: 'CCXGBPXCHFXX', exchangeId: -2, currency: 'CHF' },
} as const satisfies Record<string, Instrument>;

/** Swissquote instrument for a token, or undefined when Swissquote doesn't list it. */
export function cryptoInstrument(symbol: string): Instrument | undefined {
  const entry = catalogEntry(symbol);
  return entry && { isin: entry.isin, exchangeId: SWISSQUOTE_CRYPTO_EXCHANGE, currency: SWISSQUOTE_CRYPTO_CURRENCY };
}

/**
 * Swissquote's own market data: real-time quotes for every listed crypto plus
 * FX in one request, and daily price history. Crypto is quoted in USD and
 * converted with Swissquote's USD/CHF rate.
 */
export const swissquoteSource: MarketDataSource = {
  name: 'Swissquote',

  async snapshot(symbols, signal) {
    const instruments = new Map(symbols.map((s) => [s, cryptoInstrument(s)] as const));
    const keys = [...new Map([...instruments.values()].flatMap((i) => (i ? [[i.isin, i]] : []))).values()];
    const book = await fetchFullQuotes([...keys, ...Object.values(FX_INSTRUMENTS)], signal);

    const usd = book.get(FX_INSTRUMENTS.USD);
    const eur = book.get(FX_INSTRUMENTS.EUR);
    const gbp = book.get(FX_INSTRUMENTS.GBP);
    const quotes: MarketSnapshot['quotes'] = {};

    // Without USD/CHF no crypto price can be shown in CHF: fail closed.
    if (usd?.last) {
      const usdPrev = usd.last - (usd.netChange ?? 0);
      for (const [symbol, instrument] of instruments) {
        const q = instrument && book.get(instrument);
        if (!q?.last) continue;
        const chf = q.last * usd.last;
        // Previous close in CHF at the previous FX close, so the change includes the FX move.
        const prevChf = q.netChange === null ? null : (q.last - q.netChange) * usdPrev;
        quotes[symbol] = {
          price: chf,
          change24hPct: prevChf ? ((chf - prevChf) / prevChf) * 100 : null,
          updatedAt: q.timestamp ?? Date.now(),
        };
      }
    }

    const fxPerChf: MarketSnapshot['fxPerChf'] = { CHF: 1 };
    if (usd?.last) fxPerChf.USD = 1 / usd.last;
    if (eur?.last) fxPerChf.EUR = 1 / eur.last;
    if (gbp?.last) fxPerChf.GBP = 1 / gbp.last;
    return { quotes, fxPerChf };
  },

  async history(symbol, range, signal) {
    const instrument = cryptoInstrument(symbol);
    if (!instrument) return [];
    const now = Date.now();
    const from = rangeStart(range, now);
    const to = new Date(now + DAY);
    const series = (resolution: Resolution, parent = signal) =>
      allOrAbort(parent, [
        (s) => fetchCandles(instrument, from, to, { signal: s, resolution }),
        (s) => fetchCandles(FX_INSTRUMENTS.USD, from, to, { signal: s, resolution }),
      ] as const).then(([asset, fx]) => convertCandles(asset.candles, fx.candles));

    // 1D and 1W use hourly candles. Intraday only reaches back ~4.7 days, so
    // 1W fills the older days with daily candles.
    if (range === '1D' || range === '1W') {
      const [hourly, daily] = await allOrAbort(signal, [
        (s) => series('intraday', s),
        (s) => (range === '1W' ? series('histo', s) : Promise.resolve([])),
      ] as const);
      if (hourly.length > 1) {
        const firstHour = hourly[0]!.time;
        const cutoff = range === '1D' ? now - DAY : 0;
        const candles = [...daily.filter((c) => c.time < firstHour), ...hourly].filter((c) => c.time >= cutoff);
        if (candles.length > 1) return toPricePoints({ previousClose: null, candles }, range);
      }
    }

    // Each day converted at that day's USD/CHF close (FX has no weekend candles: the last one applies).
    const chf: Candle[] = await series('histo');
    return toPricePoints({ previousClose: null, candles: chf }, range, { dailyOnly: true });
  },
};
