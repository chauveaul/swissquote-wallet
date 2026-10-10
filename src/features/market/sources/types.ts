import type { CurrencyCode } from '@/lib/currency';

import type { Quote } from '../series';
import type { PricePoint, PriceRange, TokenSymbol } from '../types';

/** Everything the app needs for "now", fetched in one go. */
export type MarketSnapshot = {
  /** Latest CHF quote per token; a missing entry means no price is available. */
  quotes: Partial<Record<TokenSymbol, Quote>>;
  /** Units of each display currency per 1 CHF, when the source provides FX. */
  fxPerChf?: Partial<Record<CurrencyCode, number>>;
};

/** Where prices, history and FX come from. Screens never talk to a source directly. */
export interface MarketDataSource {
  /** Display name, e.g. for Settings → About. */
  readonly name: string;
  snapshot(symbols: readonly TokenSymbol[], signal?: AbortSignal): Promise<MarketSnapshot>;
  /** Chart points in CHF; empty when the token has no price source. */
  history(symbol: TokenSymbol, range: PriceRange, signal?: AbortSignal): Promise<PricePoint[]>;
}
