import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';

import { useWallet } from '@/features/wallet/store';
import { DEMO_MODE } from '@/lib/config';
import { publicClient } from '@/services/chain';
import { colors } from '@/theme/tokens';

import { demoActivity, demoPortfolio, demoPriceSeries, DEMO_NOW } from './fixtures';
import { fetchEthPriceHistory } from './priceApi';
import type { ActivityItem, Portfolio, PricePoint, PriceRange, TokenHolding, TokenSymbol } from './types';

/*
 * Data access hooks. Screens only depend on these: demo mode serves the
 * design's fixtures, live mode reads real chain state (balances via RPC,
 * ETH→CHF spot from CoinGecko's keyless API).
 */

/** Demo data is anchored to the design's date so "Today" groups line up. */
export const appNow = () => (DEMO_MODE ? DEMO_NOW : Date.now());

/** Latest CHF price per token; ETH uses the design chart's closing price. */
function demoSpotChf(symbol: TokenSymbol): number {
  if (symbol === 'ETH') return 2907.3;
  const t = demoPortfolio.tokens.find((x) => x.symbol === symbol);
  return t && t.amount ? t.valueChf / t.amount : 1;
}

/**
 * ETH→CHF spot price. The last good value is cached so a transient failure
 * (rate limit, offline) degrades to the stale price instead of zero.
 */
let cachedEthChf: number | null = null;

export async function fetchEthChf(): Promise<number> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=chf');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { ethereum?: { chf?: number } };
    const chf = data.ethereum?.chf;
    if (typeof chf !== 'number' || chf <= 0) throw new Error('Malformed price payload');
    cachedEthChf = chf;
    return chf;
  } catch {
    return cachedEthChf ?? 0;
  }
}

export function useEthChf(): number {
  const { data } = useQuery({
    queryKey: ['ethChf'],
    queryFn: fetchEthChf,
    staleTime: 60_000,
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  });
  return data ?? 0;
}

const EMPTY_PORTFOLIO: Portfolio = { tokens: [], totalChf: 0, changeTodayChf: 0, changeTodayPct: 0 };

/** bigint wei → number ETH, exact to 1e-9 ETH (up to ~9 million ETH). */
export function toEther(wei: bigint): number {
  return Number(wei / 1_000_000_000n) / 1_000_000_000;
}

function nativeHolding(amount: number, chf: number): TokenHolding {
  return {
    symbol: 'ETH',
    name: 'Ethereum',
    mark: 'ETH',
    color: colors.token.ETH,
    amount,
    displayDecimals: 6,
    valueChf: amount * chf,
    change24hPct: 0,
  };
}

export function usePortfolio(accountIndex: number) {
  const networkId = useWallet((s) => s.meta?.networkId ?? 'eth');
  const address = useWallet((s) => {
    const meta = s.meta;
    if (!meta) return null;
    return meta.accounts.find((a) => a.index === accountIndex)?.address ?? meta.accounts[0]?.address ?? null;
  });
  return useQuery({
    queryKey: ['portfolio', networkId, accountIndex],
    queryFn: async (): Promise<Portfolio> => {
      if (DEMO_MODE) {
        // Demo holdings belong to the first account; derived accounts start empty.
        return accountIndex === 0 ? demoPortfolio : EMPTY_PORTFOLIO;
      }
      if (!address) return EMPTY_PORTFOLIO;
      const [wei, chf] = await Promise.all([publicClient(networkId).getBalance({ address }), fetchEthChf()]);
      const holding = nativeHolding(toEther(wei), chf);
      return { tokens: [holding], totalChf: holding.valueChf, changeTodayChf: 0, changeTodayPct: 0 };
    },
    staleTime: 5_000,
    // Live: poll so faucet deposits and confirmations appear without a refresh.
    refetchInterval: DEMO_MODE ? false : 10_000,
  });
}

export function useToken(accountIndex: number, symbol: TokenSymbol) {
  const portfolio = usePortfolio(accountIndex);
  return portfolio.data?.tokens.find((t) => t.symbol === symbol) ?? null;
}

export function usePriceHistory(symbol: TokenSymbol, range: PriceRange) {
  return useQuery({
    queryKey: ['priceHistory', DEMO_MODE, symbol, range],
    queryFn: async (): Promise<PricePoint[]> => {
      if (DEMO_MODE) return demoPriceSeries(range, demoSpotChf(symbol));
      if (symbol === 'ETH') {
        try {
          return await fetchEthPriceHistory(range);
        } catch {
          // Unreachable (e.g. CORS-blocked in a browser preview): fall through.
        }
      }
      // Fallback: flat line at the live spot price.
      const chf = (await fetchEthChf()) || 2907.3;
      return demoPriceSeries(range, chf).map((p) => ({ ...p, value: chf }));
    },
    staleTime: 60_000,
    refetchInterval: DEMO_MODE ? false : 60_000,
    placeholderData: (prev) => prev,
  });
}

let localSeq = 0;
/** Id for a locally submitted transaction that has no hash yet. */
export const localActivityId = () => `local-${Date.now()}-${localSeq++}`;

/** Locally submitted transactions; live mode flips them once the chain confirms. */
type LocalActivity = {
  items: ActivityItem[];
  add: (item: ActivityItem) => void;
  update: (id: string, patch: Partial<ActivityItem>) => void;
};

export const useLocalActivity = create<LocalActivity>((set) => ({
  items: [],
  add: (item) => set((s) => ({ items: [item, ...s.items] })),
  update: (id, patch) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
}));

/**
 * Live mode only: poll for receipts of pending sends and flip them to
 * confirmed/failed. No-op in demo mode.
 */
function useActivityConfirmations() {
  const items = useLocalActivity((s) => s.items);
  const update = useLocalActivity((s) => s.update);

  useEffect(() => {
    if (DEMO_MODE) return;
    const pending = items.filter((i) => i.status === 'pending' && i.hash);
    if (pending.length === 0) return;

    let active = true;
    const tick = async () => {
      for (const item of pending) {
        if (!active) return;
        try {
          const networkId = useWallet.getState().meta?.networkId ?? 'eth';
          const receipt = await publicClient(networkId).getTransactionReceipt({ hash: item.hash as `0x${string}` });
          update(item.id, { status: receipt.status === 'success' ? 'confirmed' : 'failed', eta: undefined });
        } catch {
          // No receipt yet — still pending.
        }
      }
    };
    tick();
    const timer = setInterval(tick, 10_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [items, update]);

  return null;
}

export function useActivity() {
  useActivityConfirmations();
  const local = useLocalActivity((s) => s.items);
  const remote = useQuery({ queryKey: ['activity'], queryFn: async () => demoActivity });
  // Live mode shows only real (locally submitted) transactions.
  return { ...remote, data: DEMO_MODE ? [...local, ...(remote.data ?? [])] : local };
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
