import { formatEther, type Address, type Hash } from 'viem';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { create } from 'zustand';

import { useNetworkId, useSelectedAccount, useWallet, type AccountMeta } from '@/features/wallet/store';
import { DEMO_MODE, MARKET_DATA } from '@/lib/config';
import { formatNumber } from '@/lib/format';
import { getNetwork, networks, type NetworkId } from '@/lib/networks';
import { fetchTransactions, type ChainTx } from '@/services/blockscout/historyApi';
import { estimateFees, getNativeBalance, publicClient } from '@/services/chain';
import { confirmSwissquoteDeposit } from '@/services/swissquoteMock';
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

/** bigint wei → number ETH, exact to 1e-9 ETH (up to ~9 million ETH). */
export function toEther(wei: bigint): number {
  return Number(wei / 1_000_000_000n) / 1_000_000_000;
}

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
  const { wei } = await getNativeBalance(networkId, address);
  const amount = toEther(wei);
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
    queryKey: ['portfolio', accountIndex, address, networkId, ethChf],
    queryFn: () => (address ? liveNativePortfolio(networkId, address, ethChf) : Promise.resolve(EMPTY_PORTFOLIO)),
    enabled: !DEMO_MODE,
    staleTime: 5_000,
    // Poll so faucet deposits and confirmations appear without a refresh.
    refetchInterval: 10_000,
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

export type NetworkBalance = { networkId: NetworkId; name: string; mark: string; amount: number; valueChf: number | null };

/**
 * Shapes raw per-network wei balances (already fetched) into display rows,
 * priced at `ethChf` (null = unknown, so valueChf stays null rather than 0 —
 * same "unknown vs. zero" convention as `TokenHolding.priceAvailable`).
 */
export function buildNetworkBalances(
  balances: readonly { networkId: NetworkId; wei: bigint }[],
  ethChf: number | null,
): NetworkBalance[] {
  return balances.map(({ networkId, wei }) => {
    const network = getNetwork(networkId);
    const amount = toEther(wei);
    return { networkId, name: network.name, mark: network.mark, amount, valueChf: ethChf === null ? null : amount * ethChf };
  });
}

/**
 * This account's native balance on every supported network — the multi-chain
 * balance view (Accounts & networks). One account, one address, read across
 * every EVM chain it's already valid on; no bridging, just aggregation.
 * Demo mode has nothing meaningful to show here, so it's disabled.
 */
export function useNetworkBalances(accountIndex: number) {
  const address = useWallet((s) => s.meta?.accounts.find((a) => a.index === accountIndex)?.address);
  const ethChf = useQuotes().bySymbol.get('ETH')?.price ?? null;

  return useQuery({
    queryKey: ['networkBalances', accountIndex, address, ethChf],
    enabled: !DEMO_MODE && !!address,
    queryFn: async () => {
      const balances = await Promise.all(
        networks.map(async (n) => ({
          networkId: n.id,
          // One slow/unreachable RPC shouldn't blank out the others.
          wei: await getNativeBalance(n.id, address!).then((b) => b.wei, () => 0n),
        })),
      );
      return buildNetworkBalances(balances, ethChf);
    },
    staleTime: 15_000,
    refetchInterval: 20_000,
  });
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

const NO_ADDRESS = '0x0000000000000000000000000000000000000000';

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
 * confirmed/failed. No-op in demo mode. Call this once, high up in the tree
 * (the root layout) so it keeps running regardless of which screen is open —
 * it must NOT only run while the Activity tab happens to be mounted, since a
 * Swissquote deposit (below) needs to be reported to the mock server even if
 * the user never opens Activity at all.
 */
export function useActivityConfirmations() {
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
        let receipt;
        try {
          receipt = await publicClient(item.networkId).getTransactionReceipt({ hash: item.hash as Hash });
        } catch {
          continue; // Not mined yet — still pending, try again next tick.
        }
        if (receipt.status !== 'success') {
          update(item.id, { status: 'failed', eta: undefined });
          continue;
        }
        if (item.swissquoteCustomerId) {
          // Only flip to confirmed once the mock server has actually
          // acknowledged the deposit — if it's unreachable or rejects it,
          // stay pending and retry next tick rather than losing the credit
          // silently (it already landed on-chain regardless).
          try {
            await confirmSwissquoteDeposit(item.swissquoteCustomerId, item.networkId, item.hash as Hash);
          } catch (e) {
            console.warn('[swissquote] deposit not confirmed with the mock server yet, will retry:', e);
            continue;
          }
        }
        update(item.id, { status: 'confirmed', eta: undefined });
      }
    };
    tick();
    const timer = setInterval(tick, 10_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [items, update]);
}

/**
 * An on-chain transaction as seen by `account`: a send if it signed it,
 * otherwise a receive. Valued at today's price (no historical prices yet).
 * Exported for tests.
 */
export function chainTxToActivity(tx: ChainTx, account: AccountMeta, networkId: NetworkId, ethChf: number | null): ActivityItem {
  const { symbol, decimals } = getNetwork(networkId).chain.nativeCurrency;
  const outgoing = tx.from.toLowerCase() === account.address.toLowerCase();
  const amount = Number(tx.value) / 10 ** decimals;
  // Only ETH-denominated networks can be priced with the ETH quote.
  const price = symbol === 'ETH' ? ethChf : null;
  const fee = Number(tx.feeWei) / 10 ** decimals;
  const status = tx.status;
  return {
    id: tx.hash,
    kind: outgoing ? 'send' : 'receive',
    title: outgoing ? `Sent ${symbol}` : `Received ${symbol}`,
    status,
    amount: amount === 0 ? `0 ${symbol}` : `${outgoing ? '−' : '+'} ${formatNumber(amount, 4)} ${symbol}`,
    valueChf: price === null ? null : amount * price,
    timestamp: tx.timestamp,
    hash: tx.hash,
    accountIndex: account.index,
    networkId,
    counterparty: outgoing ? (tx.to ? { address: tx.to } : undefined) : { address: tx.from },
    fee: outgoing ? { native: `${formatNumber(fee, 5)} ${symbol}`, chf: price === null ? null : fee * price } : undefined,
    failureReason: status === 'failed' ? 'The transaction was reverted on-chain.' : undefined,
  };
}

/**
 * Zero-value transactions sent to the account by someone else: contract calls
 * that merely mention it, mostly address-poisoning spam. Exported for tests.
 */
export function isIncomingSpam(tx: ChainTx, account: AccountMeta): boolean {
  return tx.value === 0n && tx.from.toLowerCase() !== account.address.toLowerCase();
}

/** Pending sends not indexed yet come first; anything on-chain wins over its local copy. */
export function mergeActivity(local: ActivityItem[], chain: ActivityItem[]): ActivityItem[] {
  const contacts = new Map(local.flatMap((i) => (i.hash && i.counterparty?.label ? [[i.hash.toLowerCase(), i.counterparty]] : [])));
  const onChain = new Set(chain.map((i) => i.hash?.toLowerCase()));
  const enriched = chain.map((i) => {
    const counterparty = contacts.get(i.hash!.toLowerCase());
    return counterparty ? { ...i, counterparty } : i;
  });
  return [...local.filter((i) => !i.hash || !onChain.has(i.hash.toLowerCase())), ...enriched];
}

/**
 * The selected account's activity. Live mode reads its history on every
 * network from the explorer, so receives show up and nothing is lost when the
 * app restarts; sends from this device show immediately, before they're indexed.
 */
export function useActivity() {
  // Polling runs globally from the root layout, not here — see
  // useActivityConfirmations's own comment for why.
  const account = useSelectedAccount();
  const allLocal = useLocalActivity((s) => s.items);
  const ethChf = useQuotes().bySymbol.get('ETH')?.price ?? null;
  const demo = useQuery({ queryKey: ['activity'], queryFn: async () => demoActivity, enabled: DEMO_MODE });

  const history = useQueries({
    queries: networks.map((n) => ({
      queryKey: ['history', account.address, n.id],
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchTransactions(n.id, account.address, signal),
      enabled: !DEMO_MODE && account.address !== NO_ADDRESS,
      staleTime: 15_000,
      refetchInterval: 30_000,
      retry: 1,
    })),
  });

  const local = allLocal.filter((i) => i.accountIndex === account.index);
  const chain = history.flatMap((q, i) =>
    (q.data ?? []).filter((tx) => !isIncomingSpam(tx, account)).map((tx) => chainTxToActivity(tx, account, networks[i]!.id, ethChf)),
  );
  const refetch = () => {
    if (DEMO_MODE) demo.refetch();
    else history.forEach((q) => q.refetch());
  };
  const isRefetching = DEMO_MODE ? demo.isRefetching : history.some((q) => q.isRefetching);

  if (DEMO_MODE) return { data: [...allLocal, ...(demo.data ?? [])], refetch, isRefetching, isLoading: demo.isLoading };
  return {
    data: mergeActivity(local, chain),
    refetch,
    isRefetching,
    isLoading: history.some((q) => q.isLoading),
  };
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
