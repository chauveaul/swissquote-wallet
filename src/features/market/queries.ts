import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';

import { DEMO_MODE } from '@/lib/config';

import { demoActivity, demoPortfolio, demoPriceSeries, demoSpotChf, DEMO_NOW } from './fixtures';
import type { ActivityItem, MarketToken, Portfolio, PriceRange, TokenSymbol } from './types';

/*
 * Data access hooks. Screens only depend on these, so replacing the demo
 * fixtures with a market-data / indexer backend is a change confined to this file.
 */

/** Demo data is anchored to the design's date so "Today" groups line up. */
export const appNow = () => (DEMO_MODE ? DEMO_NOW : Date.now());

const SEED_OFFSET: Record<TokenSymbol, number> = { ETH: 0, WBTC: 101, USDC: 202, LINK: 303 };

const EMPTY_PORTFOLIO: Portfolio = { tokens: [], totalChf: 0, changeTodayChf: 0, changeTodayPct: 0 };

export function usePortfolio(accountIndex: number) {
  return useQuery({
    queryKey: ['portfolio', accountIndex],
    // Demo holdings belong to the first account; derived accounts start empty.
    queryFn: async () => (accountIndex === 0 ? demoPortfolio : EMPTY_PORTFOLIO),
    staleTime: 30_000,
  });
}

export function useToken(accountIndex: number, symbol: TokenSymbol) {
  const portfolio = usePortfolio(accountIndex);
  return portfolio.data?.tokens.find((t) => t.symbol === symbol) ?? null;
}

const demoMarkets: MarketToken[] = demoPortfolio.tokens.map(({ symbol, name, mark, color, change24hPct }) => ({
  symbol,
  name,
  mark,
  color,
  change24hPct,
  priceChf: demoSpotChf(symbol),
}));

/** Tradable tokens with spot price and 24h change (Explore). */
export function useMarkets() {
  return useQuery({ queryKey: ['markets'], queryFn: async () => demoMarkets, staleTime: 30_000 });
}

export function useMarketToken(symbol: TokenSymbol) {
  return useMarkets().data?.find((t) => t.symbol === symbol) ?? null;
}

export function usePriceHistory(symbol: TokenSymbol, range: PriceRange) {
  return useQuery({
    queryKey: ['priceHistory', symbol, range],
    queryFn: async () => {
      const end = demoSpotChf(symbol);
      // ETH keeps the design's seeds; other tokens get their own curve.
      const series = demoPriceSeries(range, end, SEED_OFFSET[symbol]);
      // A stablecoin should hover around its peg, not swing like ETH.
      return symbol === 'USDC' ? series.map((p) => ({ ...p, value: end + (p.value - end) * 0.01 })) : series;
    },
    staleTime: 60_000,
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
