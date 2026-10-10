import type { Address } from 'viem';

import type { NetworkId } from '@/lib/networks';

export type TokenSymbol = 'ETH' | 'WBTC' | 'USDC' | 'LINK';

export type TokenHolding = {
  symbol: TokenSymbol;
  name: string;
  /** Badge label shown in the token mark ("BTC" for WBTC). */
  mark: string;
  color: string;
  amount: number;
  /** Decimals shown in the UI for this token's amount. */
  displayDecimals: number;
  valueChf: number;
  change24hPct: number;
};

/** Token as listed on the market, independent of any holding. */
export type MarketToken = Pick<TokenHolding, 'symbol' | 'name' | 'mark' | 'color' | 'change24hPct'> & {
  priceChf: number;
};

export type Portfolio = {
  tokens: TokenHolding[];
  totalChf: number;
  changeTodayChf: number;
  changeTodayPct: number;
};

export type PriceRange = '1D' | '1W' | '1M' | '1Y' | 'ALL';

export type PricePoint = { value: number; label: string };

export type ActivityKind = 'send' | 'receive' | 'swap' | 'approve';
export type ActivityStatus = 'pending' | 'confirmed' | 'failed';

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  status: ActivityStatus;
  /** Shown next to "Pending" (e.g. "~ 30 sec"). */
  eta?: string;
  amount: string;
  fiat: string;
  /** Unix ms; used for grouping by day. */
  timestamp: number;
  /** On-chain transaction hash; absent for demo or not-yet-broadcast items. */
  hash?: string;
  /** Index of the wallet account that made or received it. */
  accountIndex: number;
  networkId: NetworkId;
  /** Recipient (send), sender (receive) or approved spender (approve). */
  counterparty?: { label?: string; address: Address };
  /** e.g. "0.00042 ETH · CHF 1.22" */
  fee?: string;
  swap?: { paid: string; received: string; rate: string; minReceived: string };
  failureReason?: string;
};

export type Contact = { name: string; address: Address };

export type FeeSpeed = 'low' | 'market' | 'fast';
