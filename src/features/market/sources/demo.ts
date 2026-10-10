import { CURRENCIES } from '@/lib/currency';

import { DEMO_NOW, demoPortfolio, demoPriceSeries, demoSpotChf } from '../fixtures';
import type { Quote } from '../series';
import type { PriceRange, TokenSymbol } from '../types';
import type { MarketDataSource } from './types';

const SEED_OFFSET: Partial<Record<TokenSymbol, number>> = { ETH: 0, WBTC: 101, USDC: 202, LINK: 303 };

/** The design's fixed sample prices and FX rates. */
export const demoSource: MarketDataSource = {
  name: 'Demo data',
  async snapshot(symbols) {
    const quotes: Partial<Record<TokenSymbol, Quote>> = {};
    // Only the design's four tokens have demo prices; everything else stays unpriced.
    for (const symbol of symbols.filter((s) => demoPortfolio.tokens.some((t) => t.symbol === s))) {
      const change = demoPortfolio.tokens.find((t) => t.symbol === symbol)?.change24hPct ?? 0;
      quotes[symbol] = { price: demoSpotChf(symbol), change24hPct: change, updatedAt: DEMO_NOW };
    }
    return { quotes, fxPerChf: Object.fromEntries(CURRENCIES.map((c) => [c.code, c.perChf])) };
  },
  async history(symbol: TokenSymbol, range: PriceRange) {
    const end = demoSpotChf(symbol);
    // ETH keeps the design's seeds; other tokens get their own curve.
    const series = demoPriceSeries(range, end, SEED_OFFSET[symbol] ?? 0);
    // A stablecoin should hover around its peg, not swing like ETH.
    return symbol === 'USDC' ? series.map((p) => ({ ...p, value: end + (p.value - end) * 0.01 })) : series;
  },
};
