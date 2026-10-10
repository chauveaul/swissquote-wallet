import { create } from 'zustand';

import { demoQuotes } from '@/features/market/fixtures';
import type { TokenSymbol } from '@/features/market/types';
import { sanitizeAmount } from '@/features/send/draft';
import { formatNumber } from '@/lib/format';

/** How long a quote may be confirmed before it must be refreshed. */
export const QUOTE_TTL_S = 30;

type Side = { symbol: TokenSymbol; decimals: number; chf: number };

const ETH: Side = { symbol: 'ETH', decimals: 4, chf: demoQuotes.ethChf };
const USDC: Side = { symbol: 'USDC', decimals: 2, chf: demoQuotes.ethChf / demoQuotes.ethUsdc };

export type SwapQuote = {
  from: Side;
  to: Side;
  pay: number;
  receive: number;
  /** Worst case after max. slippage; below this the swap is cancelled. */
  minReceive: number;
  payChf: number;
  receiveChf: number;
  rateLabel: string;
  slippagePct: number;
  networkFeeChf: number;
  providers: string;
  swissquoteFee: string;
};

/** Demo quote for ETH⇄USDC; replace with an aggregator call in production. */
export function quoteSwap(flipped: boolean, pay: number): SwapQuote {
  const from = flipped ? USDC : ETH;
  const to = flipped ? ETH : USDC;
  const rate = flipped ? 1 / demoQuotes.ethUsdc : demoQuotes.ethUsdc;
  const receive = pay * rate;
  const payChf = pay * from.chf;
  return {
    from,
    to,
    pay,
    receive,
    minReceive: receive * (1 - demoQuotes.slippagePct / 100),
    payChf,
    receiveChf: payChf * demoQuotes.swapValueRatio,
    rateLabel: flipped
      ? `1 USDC = ${formatNumber(1 / demoQuotes.ethUsdc, 6)} ETH`
      : `1 ETH = ${formatNumber(demoQuotes.ethUsdc)} USDC`,
    slippagePct: demoQuotes.slippagePct,
    networkFeeChf: demoQuotes.swapNetworkFeeChf,
    providers: demoQuotes.providersCompared,
    swissquoteFee: demoQuotes.swissquoteFee,
  };
}

/** Swap being composed on Swap and confirmed on Review swap. */
type SwapDraft = {
  flipped: boolean;
  pay: string;
  setFlipped: (flipped: boolean) => void;
  setPay: (pay: string) => void;
  reset: () => void;
};

export const useSwapDraft = create<SwapDraft>((set) => ({
  flipped: false,
  pay: '',
  setFlipped: (flipped) => set({ flipped }),
  setPay: (pay) => set({ pay: sanitizeAmount(pay) }),
  reset: () => set({ flipped: false, pay: '' }),
}));
