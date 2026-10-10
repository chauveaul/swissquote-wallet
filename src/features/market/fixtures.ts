import { getAddress } from 'viem';

import { colors } from '@/theme/tokens';

import { formatPointLabel } from './labels';

import type { ActivityItem, ConnectedSite, Contact, Portfolio, PricePoint, PriceRange, TokenHolding, TokenSymbol } from './types';

/*
 * Demo data copied verbatim from the design. Served through the hooks in
 * `./queries.ts`; swap those for a price/indexer API in production.
 */

const tokens: TokenHolding[] = [
  { symbol: 'ETH', name: 'Ethereum', mark: 'ETH', color: colors.token.ETH, amount: 2.412, displayDecimals: 4, valueChf: 7012.4, change24hPct: 3.1 },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', mark: 'BTC', color: colors.token.WBTC, amount: 0.051, displayDecimals: 4, valueChf: 3105.75, change24hPct: 1.42 },
  { symbol: 'USDC', name: 'USD Coin', mark: 'USDC', color: colors.token.USDC, amount: 1950, displayDecimals: 2, valueChf: 1722.1, change24hPct: 0 },
  { symbol: 'LINK', name: 'Chainlink', mark: 'LINK', color: colors.token.LINK, amount: 58.2, displayDecimals: 2, valueChf: 640.3, change24hPct: -0.85 },
];

export const demoPortfolio: Portfolio = {
  tokens,
  totalChf: tokens.reduce((sum, t) => sum + t.valueChf, 0),
  changeTodayChf: 291.2,
  changeTodayPct: 2.39,
};

/** Latest CHF market price per token (Explore, token picker, Buy); ETH uses the design chart's close. */
export function demoSpotChf(symbol: TokenSymbol): number {
  if (symbol === 'ETH') return 2907.3;
  const t = tokens.find((x) => x.symbol === symbol);
  return t && t.amount ? t.valueChf / t.amount : 1;
}

/** Spot quotes used for fiat conversion on Send / Swap. */
export const demoQuotes = {
  ethChf: 2907.4,
  ethUsdc: 3293.64,
  /** CHF value received per CHF paid on ETH→USDC, after spread. */
  swapValueRatio: 725.1 / 726.85,
  slippagePct: 0.5,
  swapNetworkFeeChf: 2.1,
  /** Business inputs still open in the design. */
  providersCompared: '[N] providers compared',
  swissquoteFee: '[FEE %]',
  /** Network fee in ETH per speed; "market" is the design's 0.00042 ETH. */
  feeEth: { low: 0.00031, market: 0.00042, fast: 0.00058 },
  feeEta: { low: '~ 2 min', market: '~ 30 sec', fast: '~ 15 sec' },
} as const;

export const demoContacts: Contact[] = [
  // The design shows `0x8Ba1…`, which fails EIP-55; this is the correctly checksummed form.
  { name: 'Mia (Ledger)', address: '0x8ba1f109551bD432803012645Ac136ddd64DBA72' },
];

const DAY = 86_400_000;
/** Design reference "now": 10 October 2026, 14:30. */
export const DEMO_NOW = new Date(2026, 9, 10, 14, 30).getTime();

/** Demo dApp sessions behind Settings → Connected sites (no WalletConnect integration yet). */
export const demoConnectedSites: ConnectedSite[] = [
  { id: 's1', name: 'Uniswap', host: 'app.uniswap.org', networkId: 'eth', connectedAt: DEMO_NOW - 3 * DAY },
  { id: 's2', name: 'Aave', host: 'app.aave.com', networkId: 'eth', connectedAt: DEMO_NOW - 12 * DAY },
  { id: 's3', name: 'OpenSea', host: 'opensea.io', networkId: 'base', connectedAt: DEMO_NOW - 40 * DAY },
];

/** Demo counterparties (not real people or services). */
const DEMO_SENDER = getAddress('0x2f6a1d3c5e7b9a0c4d6e8f1a3b5c7d9e0f2a4b6c');
const DEMO_SPENDER = getAddress('0x7a3e5c1b9d2f4a6c8e0b1d3f5a7c9e2b4d6f8a0c');

const demoBase = { accountIndex: 0, networkId: 'eth' } as const;

export const demoActivity: ActivityItem[] = [
  {
    ...demoBase,
    id: 'a2',
    kind: 'swap',
    title: 'Swapped ETH → USDC',
    status: 'confirmed',
    amount: '+ 823.41 USDC',
    valueChf: 725.1,
    timestamp: DEMO_NOW - 3_600_000,
    fee: { chf: 2.1 },
    swap: { paid: '− 0.2500 ETH', received: '+ 823.41 USDC', rate: '1 ETH = 3’293.64 USDC', minReceived: '819.29 USDC' },
  },
  {
    ...demoBase,
    id: 'a3',
    kind: 'receive',
    title: 'Received ETH',
    status: 'confirmed',
    amount: '+ 1.2000 ETH',
    valueChf: 3488.9,
    timestamp: DEMO_NOW - 2 * DAY,
    counterparty: { address: DEMO_SENDER },
  },
  {
    ...demoBase,
    id: 'a4',
    kind: 'approve',
    title: 'Approve USDC spend',
    status: 'confirmed',
    amount: '0 USDC',
    valueChf: 0.84,
    valueIsFee: true,
    timestamp: DEMO_NOW - 2 * DAY - 60_000,
    counterparty: { label: 'Swap router (demo)', address: DEMO_SPENDER },
    fee: { native: '0.00029 ETH', chf: 0.84 },
  },
  {
    ...demoBase,
    id: 'a5',
    kind: 'send',
    title: 'Sent LINK',
    status: 'failed',
    amount: '− 10.00 LINK',
    valueChf: 110,
    timestamp: DEMO_NOW - 2 * DAY - 120_000,
    counterparty: { label: 'Mia (Ledger)', address: '0x8ba1f109551bD432803012645Ac136ddd64DBA72' },
    fee: { native: '0.00038 ETH', chf: 1.1 },
    failureReason: 'The transaction ran out of gas. The network fee was still charged; no LINK left your wallet.',
  },
];

const RANGE_CFG: Record<PriceRange, { n: number; stepMin: number; vol: number; seed: number }> = {
  '1D': { n: 48, stepMin: 30, vol: 0.004, seed: 11 },
  '1W': { n: 56, stepMin: 180, vol: 0.009, seed: 23 },
  '1M': { n: 60, stepMin: 720, vol: 0.018, seed: 37 },
  '1Y': { n: 52, stepMin: 10080, vol: 0.06, seed: 41 },
  ALL: { n: 60, stepMin: 60480, vol: 0.13, seed: 53 },
};

/** Deterministic price history — same generator and seeds as the design prototype. */
export function demoPriceSeries(range: PriceRange, end = 2907.3, seedOffset = 0): PricePoint[] {
  const cfg = RANGE_CFG[range];
  let s = cfg.seed + seedOffset;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const vals = [end];
  const drift = range === 'ALL' ? 0.035 : 0.002;
  for (let i = 1; i < cfg.n; i++) {
    const prev = vals[i - 1]!;
    // Floor scaled from the design's CHF 20 floor for ETH, so cheap tokens aren't clamped.
    vals.push(Math.max(prev * (1 - drift + (rnd() - 0.5) * 2 * cfg.vol), end * (20 / 2907.3)));
  }
  vals.reverse();


  return vals.map((value, i) => ({
    value,
    label: formatPointLabel(range, new Date(DEMO_NOW - (cfg.n - 1 - i) * cfg.stepMin * 60_000)),
  }));
}
