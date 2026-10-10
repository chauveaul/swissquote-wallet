import { colors } from '@/theme/tokens';

import type { ActivityItem, Contact, Portfolio, PricePoint, PriceRange, TokenHolding } from './types';

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

export const demoActivity: ActivityItem[] = [
  { id: 'a2', kind: 'swap', title: 'Swapped ETH → USDC', status: 'confirmed', amount: '+ 823.41 USDC', fiat: 'CHF 725.10', timestamp: DEMO_NOW - 3_600_000 },
  { id: 'a3', kind: 'receive', title: 'Received ETH', status: 'confirmed', amount: '+ 1.2000 ETH', fiat: 'CHF 3’488.90', timestamp: DEMO_NOW - 2 * DAY },
  { id: 'a4', kind: 'approve', title: 'Approve USDC spend', status: 'confirmed', amount: '0 USDC', fiat: 'Fee CHF 0.84', timestamp: DEMO_NOW - 2 * DAY - 60_000 },
  { id: 'a5', kind: 'send', title: 'Sent LINK', status: 'failed', amount: '− 10.00 LINK', fiat: 'CHF 110.00', timestamp: DEMO_NOW - 2 * DAY - 120_000 },
];

const RANGE_CFG: Record<PriceRange, { n: number; stepMin: number; vol: number; seed: number }> = {
  '1D': { n: 48, stepMin: 30, vol: 0.004, seed: 11 },
  '1W': { n: 56, stepMin: 180, vol: 0.009, seed: 23 },
  '1M': { n: 60, stepMin: 720, vol: 0.018, seed: 37 },
  '1Y': { n: 52, stepMin: 10080, vol: 0.06, seed: 41 },
  ALL: { n: 60, stepMin: 60480, vol: 0.13, seed: 53 },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (x: number) => String(x).padStart(2, '0');

/** Deterministic price history — same generator and seeds as the design prototype. */
export function demoPriceSeries(range: PriceRange, end = 2907.3): PricePoint[] {
  const cfg = RANGE_CFG[range];
  let s = cfg.seed;
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

  const fmt = (d: Date) => {
    if (range === '1D') return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (range === '1W') return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${pad(d.getHours())}:00`;
    if (range === '1M') return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };

  return vals.map((value, i) => ({
    value,
    label: fmt(new Date(DEMO_NOW - (cfg.n - 1 - i) * cfg.stepMin * 60_000)),
  }));
}
