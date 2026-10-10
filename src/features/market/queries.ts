import { formatEther, type Address } from 'viem';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { create } from 'zustand';

import { useNetworkId, useWallet } from '@/features/wallet/store';
import { DEMO_MODE, MARKET_DATA } from '@/lib/config';
import type { NetworkId } from '@/lib/networks';
import { estimateFees, getNativeBalance } from '@/services/chain';
import { colors } from '@/theme/tokens';

import { assetName, CRYPTO_CATALOG, tokenColor, tokenMark, WALLET_TOKENS } from './catalog';
import { demoActivity, demoPortfolio, demoQuotes, DEMO_NOW } from './fixtures';
import type { Quote } from './series';
import { marketData } from './sources';
import type { ActivityItem, FeeSpeed, MarketToken, Portfolio, PriceRange, TokenHolding, TokenSymbol } from './types';

/*
 * Data access hooks. Screens only depend on these; where prices come from
 * (demo fixtures or Swissquote) is decided by `marketData` in ./sources.
 * Balances and the network fee come from the chain for real when
 * `DEMO_MODE=false` (see `usePortfolio`/`useFeeEstimate` below).
 */

/** Demo data is anchored to the design's date so "Today" groups line up. */
export const appNow = () => (DEMO_MODE ? DEMO_NOW : Date.now());

/** Everything the markets list shows: the wallet's tokens first, then every Swissquote crypto. */
const MARKET_SYMBOLS: readonly TokenSymbol[] = [
  ...WALLET_TOKENS,
  ...CRYPTO_CATALOG.map((a) => a.symbol).filter((s) => !WALLET_TOKENS.includes(s)),
];

const QUOTE_REFRESH_MS = 60_000;
const SYMBOLS = MARKET_SYMBOLS;

/**
 * Latest quotes for every listed token plus FX, in one request, refreshed every
 * minute while the app is in the foreground. A failed refresh keeps the last
 * good values and is reported via `delayed`.
 */
export function useQuotes() {
  const q = useQuery({
    queryKey: ['quotes', MARKET_DATA],
    queryFn: ({ signal }) => marketData.snapshot(SYMBOLS, signal),
    staleTime: 30_000,
    refetchInterval: QUOTE_REFRESH_MS,
    retry: 2,
  });
  const bySymbol = new Map<TokenSymbol, Quote | null>(SYMBOLS.map((s) => [s, q.data?.quotes[s] ?? null]));
  const hasPrice = SYMBOLS.some((s) => q.data?.quotes[s]);
  return {
    bySymbol,
    fxPerChf: q.data?.fxPerChf ?? null,
    /** Last successful refresh with at least one price, for "updated hh:mm". */
    updatedAt: hasPrice ? q.dataUpdatedAt : null,
    /** The latest refresh failed; shown values may be old or missing. */
    delayed: q.isError,
    isLoading: q.isLoading,
    isRefetching: q.isRefetching,
  };
}

/** Prices are live (not demo fixtures). */
export const PRICES_LIVE = MARKET_DATA !== 'demo';

const EMPTY_PORTFOLIO: Portfolio = { tokens: [], totalChf: 0, changeTodayChf: 0, changeTodayPct: 0 };

/** Holdings valued at the latest prices. Demo-mode balances only. */
export function valuePortfolio(base: Portfolio, quotes: Map<TokenSymbol, Quote | null>): Portfolio {
  const tokens: TokenHolding[] = base.tokens.map((t) => {
    const q = quotes.get(t.symbol);
    if (!q) return { ...t, valueChf: 0, change24hPct: 0, priceAvailable: false };
    return { ...t, valueChf: t.amount * q.price, change24hPct: q.change24hPct ?? 0, priceAvailable: true };
  });
  const totalChf = tokens.reduce((s, t) => s + t.valueChf, 0);
  // Today's change per token: value − value / (1 + pct).
  const changeTodayChf = tokens.reduce((s, t) => s + (t.valueChf * t.change24hPct) / (100 + t.change24hPct), 0);
  const opening = totalChf - changeTodayChf;
  return { tokens, totalChf, changeTodayChf, changeTodayPct: opening > 0 ? (changeTodayChf / opening) * 100 : 0 };
}

/**
 * Real holdings, live mode: native ETH balance read from the chain, priced at
 * the live Swissquote spot rate when available (falls back to the fixture
 * rate while that quote hasn't loaded yet — same fallback demo mode uses).
 * No indexer yet, so only the native balance is read; WBTC/USDC/LINK stay
 * demo-only.
 */
async function liveNativePortfolio(networkId: NetworkId, address: Address, ethChf: number | null): Promise<Portfolio> {
  const { formatted } = await getNativeBalance(networkId, address);
  const amount = Number(formatted);
  if (amount <= 0) return EMPTY_PORTFOLIO;
  const valueChf = amount * (ethChf ?? demoQuotes.ethChf);
  const eth: TokenHolding = {
    symbol: 'ETH',
    name: 'Ethereum',
    mark: 'ETH',
    color: colors.token.ETH,
    amount,
    displayDecimals: 4,
    valueChf,
    change24hPct: 0,
    priceAvailable: ethChf !== null,
  };
  return { tokens: [eth], totalChf: valueChf, changeTodayChf: 0, changeTodayPct: 0 };
}

export function usePortfolio(accountIndex: number) {
  const networkId = useNetworkId();
  const address = useWallet((s) => s.meta?.accounts.find((a) => a.index === accountIndex)?.address);
  const quotes = useQuotes();
  const queryClient = useQueryClient();
  const ethChf = quotes.bySymbol.get('ETH')?.price ?? null;

  const live = useQuery({
    queryKey: ['portfolio', accountIndex, networkId, ethChf],
    queryFn: () => (address ? liveNativePortfolio(networkId, address, ethChf) : Promise.resolve(EMPTY_PORTFOLIO)),
    enabled: !DEMO_MODE,
    staleTime: 30_000,
  });

  // Demo holdings belong to the first account; derived accounts start empty.
  const demoBase = accountIndex === 0 ? demoPortfolio : EMPTY_PORTFOLIO;
  const demoData = PRICES_LIVE ? valuePortfolio(demoBase, quotes.bySymbol) : demoBase;

  const refetch = useCallback(() => {
    if (!DEMO_MODE) live.refetch();
    queryClient.invalidateQueries({ queryKey: ['quotes'] });
  }, [live, queryClient]);

  if (DEMO_MODE) return { data: demoData, isRefetching: quotes.isRefetching, refetch, delayed: quotes.delayed };
  return { data: live.data ?? EMPTY_PORTFOLIO, isRefetching: live.isRefetching || quotes.isRefetching, refetch, delayed: quotes.delayed };
}

/**
 * Network fee for a transfer: a real EIP-1559 estimate in live mode, the
 * fixture amount in demo mode — priced at the live ETH rate when available,
 * same fallback/null convention as `feeFor` in `features/send/draft.ts`.
 */
export function useFeeEstimate(networkId: NetworkId, speed: FeeSpeed, ethChf: number | null) {
  const toChf = (eth: number) => (ethChf === null ? null : eth * ethChf);
  const fixture = { eth: demoQuotes.feeEth[speed], chf: toChf(demoQuotes.feeEth[speed]), eta: demoQuotes.feeEta[speed] };
  return useQuery({
    queryKey: ['fee', networkId, speed, DEMO_MODE, ethChf],
    queryFn: async () => {
      if (DEMO_MODE) return fixture;
      // 21000 gas: the cost of a plain native transfer (what `sendNative` sends).
      const { maxFeePerGas } = await estimateFees(networkId, speed);
      const eth = Number(formatEther(maxFeePerGas * 21_000n));
      return { eth, chf: toChf(eth), eta: fixture.eta };
    },
    placeholderData: fixture,
    staleTime: 10_000,
  });
}

export function useToken(accountIndex: number, symbol: TokenSymbol) {
  return usePortfolio(accountIndex).data.tokens.find((t) => t.symbol === symbol) ?? null;
}

/** Tradable tokens with latest price and daily change (Explore, token picker). */
export function useMarkets() {
  const quotes = useQuotes();
  const queryClient = useQueryClient();
  const data: MarketToken[] = MARKET_SYMBOLS.map((symbol) => {
    const q = quotes.bySymbol.get(symbol);
    return {
      symbol,
      name: assetName(symbol),
      mark: tokenMark(symbol),
      color: tokenColor(symbol),
      priceChf: q?.price ?? null,
      change24hPct: q?.change24hPct ?? null,
    };
  });
  const refetch = useCallback(() => queryClient.invalidateQueries({ queryKey: ['quotes'] }), [queryClient]);
  return { data, refetch, isRefetching: quotes.isRefetching, delayed: quotes.delayed, updatedAt: quotes.updatedAt };
}

export function useMarketToken(symbol: TokenSymbol) {
  return useMarkets().data.find((t) => t.symbol === symbol) ?? null;
}

/** Latest CHF price of one token, or null when unavailable. */
export function useSpotPrice(symbol: TokenSymbol): number | null {
  return useQuotes().bySymbol.get(symbol)?.price ?? null;
}

export function usePriceHistory(symbol: TokenSymbol, range: PriceRange) {
  return useQuery({
    queryKey: ['priceHistory', MARKET_DATA, symbol, range],
    queryFn: ({ signal }) => marketData.history(symbol, range, signal),
    staleTime: 60_000,
    retry: 2,
    placeholderData: (prev) => prev,
  });
}

let localSeq = 0;
/** Id for a locally submitted transaction that has no hash yet. */
export const localActivityId = () => `local-${Date.now()}-${localSeq++}`;

/** Locally submitted transactions, shown as pending until indexed. */
type LocalActivity = { items: ActivityItem[]; add: (item: ActivityItem) => void };

export const useLocalActivity = create<LocalActivity>((set) => ({
  items: [],
  add: (item) => set((s) => ({ items: [item, ...s.items] })),
}));

export function useActivity() {
  const local = useLocalActivity((s) => s.items);
  const remote = useQuery({ queryKey: ['activity'], queryFn: async () => demoActivity });
  return { ...remote, data: [...local, ...(remote.data ?? [])] };
}

export type ActivityGroup = { label: string; items: ActivityItem[] };

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Groups by calendar day: "Today", then "8 October 2026". */
export function groupActivity(items: ActivityItem[], now = appNow()): ActivityGroup[] {
  const dayKey = (t: number) => new Date(t).toDateString();
  const today = dayKey(now);
  const groups = new Map<string, ActivityGroup>();
  for (const item of [...items].sort((a, b) => b.timestamp - a.timestamp)) {
    const key = dayKey(item.timestamp);
    const d = new Date(item.timestamp);
    const label = key === today ? 'Today' : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    if (!groups.has(key)) groups.set(key, { label, items: [] });
    groups.get(key)!.items.push(item);
  }
  return [...groups.values()];
}
