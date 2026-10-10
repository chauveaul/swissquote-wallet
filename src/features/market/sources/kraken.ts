import { fetchOhlc, fetchTickers, type OhlcInterval } from '@/services/kraken/krakenApi';

import { convertCandles, toPricePoints, type Quote } from '../series';
import type { PriceRange, TokenSymbol } from '../types';
import type { MarketDataSource, MarketSnapshot } from './types';

/** Kraken pair per token. Tokens without a CHF market are priced in USD and converted. */
export const KRAKEN_PAIRS: Partial<Record<TokenSymbol, { pair: string; quote: 'CHF' | 'USD' }>> = {
  ETH: { pair: 'ETH/CHF', quote: 'CHF' },
  WBTC: { pair: 'WBTC/USD', quote: 'USD' },
  USDC: { pair: 'USDC/CHF', quote: 'CHF' },
  LINK: { pair: 'LINK/USD', quote: 'USD' },
};

const FX_PAIRS = ['USD/CHF', 'EUR/CHF', 'GBP/USD'] as const;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Candle width and lookback per chart range (Kraken returns at most 720 candles). */
const RANGE_CANDLES: Record<PriceRange, { interval: OhlcInterval; lookback: number }> = {
  '1D': { interval: 15, lookback: DAY },
  '1W': { interval: 60, lookback: 7 * DAY },
  '1M': { interval: 240, lookback: 30 * DAY },
  '1Y': { interval: 1440, lookback: 365 * DAY },
  ALL: { interval: 10080, lookback: Infinity },
};

/** Live crypto prices and FX from Kraken's public market data. */
export const krakenSource: MarketDataSource = {
  name: 'Kraken',

  async snapshot(symbols, signal) {
    const tokenPairs = symbols.flatMap((s) => (KRAKEN_PAIRS[s] ? [KRAKEN_PAIRS[s]!.pair] : []));
    const tickers = await fetchTickers([...tokenPairs, ...FX_PAIRS], signal);
    const usdChf = tickers.get('USD/CHF')!;
    const eurChf = tickers.get('EUR/CHF')!;
    const gbpUsd = tickers.get('GBP/USD')!;
    const updatedAt = Date.now();

    const quotes: MarketSnapshot['quotes'] = {};
    for (const symbol of symbols) {
      const cfg = KRAKEN_PAIRS[symbol];
      const t = cfg && tickers.get(cfg.pair);
      if (!cfg || !t) continue;
      // CHF value now vs. at today's open, so USD-quoted tokens include the FX move.
      const nowChf = cfg.quote === 'USD' ? t.last * usdChf.last : t.last;
      const openChf = cfg.quote === 'USD' ? t.open * usdChf.open : t.open;
      const quote: Quote = { price: nowChf, change24hPct: ((nowChf - openChf) / openChf) * 100, updatedAt };
      quotes[symbol] = quote;
    }

    return {
      quotes,
      fxPerChf: {
        CHF: 1,
        USD: 1 / usdChf.last,
        EUR: 1 / eurChf.last,
        GBP: 1 / (gbpUsd.last * usdChf.last),
      },
    };
  },

  async history(symbol, range, signal) {
    const cfg = KRAKEN_PAIRS[symbol];
    if (!cfg) return [];
    const { interval, lookback } = RANGE_CANDLES[range];
    const since = new Date(Number.isFinite(lookback) ? Date.now() - lookback : 0);
    const [candles, fx] = await Promise.all([
      fetchOhlc(cfg.pair, interval, since, signal),
      cfg.quote === 'USD' ? fetchOhlc('USD/CHF', interval, since, signal) : Promise.resolve(null),
    ]);
    const chf = fx ? convertCandles(candles, fx) : candles;
    return toPricePoints({ previousClose: null, candles: chf }, range);
  },
};
