import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';

import { DEMO_MODE } from '@/lib/config';

import { demoActivity, demoPortfolio, demoPriceSeries, DEMO_NOW } from './fixtures';
import type { ActivityItem, Portfolio, PriceRange, TokenSymbol } from './types';

/*
 * Data access hooks. Screens only depend on these, so replacing the demo
 * fixtures with a market-data / indexer backend is a change confined to this file.
 */

/** Demo data is anchored to the design's date so "Today" groups line up. */
export const appNow = () => (DEMO_MODE ? DEMO_NOW : Date.now());

/** Latest CHF price per token; ETH uses the design chart's closing price. */
function demoSpotChf(symbol: TokenSymbol): number {
  if (symbol === 'ETH') return 2907.3;
  const t = demoPortfolio.tokens.find((x) => x.symbol === symbol);
  return t && t.amount ? t.valueChf / t.amount : 1;
}

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

export function usePriceHistory(symbol: TokenSymbol, range: PriceRange) {
  return useQuery({
    queryKey: ['priceHistory', symbol, range],
    queryFn: async () => demoPriceSeries(range, demoSpotChf(symbol)),
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
