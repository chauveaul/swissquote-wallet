import { create } from 'zustand';

import { demoQuotes } from '@/features/market/fixtures';
import type { TokenSymbol } from '@/features/market/types';
import { sanitizeAmount } from '@/features/send/draft';
import { formatNumber } from '@/lib/format';

export const MIN_BUY_CHF = 20;
export const MAX_BUY_CHF = 10_000;

/** Funding source. Matches Settings → "Link your Swissquote account". */
export const PAYMENT_METHOD = 'Swissquote account (demo)';

export type BuyQuote = {
  symbol: TokenSymbol;
  chf: number;
  /** Null when no live price exists: the purchase can't be quoted. */
  priceChf: number | null;
  receive: number;
  decimals: number;
  priceLabel: string;
  fee: string;
};

/** Demo quote; replace with the Swissquote order API. The fee is still an open business input. */
/** `price` is the same live CHF price the token list shows, so the quote matches what was picked. */
export function quoteBuy(symbol: TokenSymbol, chf: number, price: number | null): BuyQuote {
  const decimals = symbol === 'USDC' || symbol === 'LINK' ? 2 : 4;
  return {
    symbol,
    chf,
    priceChf: price,
    receive: price ? chf / price : 0,
    decimals,
    priceLabel: price === null ? 'Price unavailable' : `1 ${symbol} = CHF ${formatNumber(price, price < 1 ? 4 : 2)}`,
    fee: demoQuotes.swissquoteFee,
  };
}

/** Purchase being composed on Buy and confirmed on Review purchase. */
type BuyDraft = {
  symbol: TokenSymbol;
  chf: string;
  setSymbol: (symbol: TokenSymbol) => void;
  setChf: (chf: string) => void;
  reset: () => void;
};

export const useBuyDraft = create<BuyDraft>((set) => ({
  symbol: 'ETH',
  chf: '',
  setSymbol: (symbol) => set({ symbol }),
  setChf: (chf) => set({ chf: sanitizeAmount(chf) }),
  reset: () => set({ symbol: 'ETH', chf: '' }),
}));
