import type { Address } from 'viem';

import type { NetworkId } from '@/lib/networks';

/** Ticker, e.g. "ETH". Any asset in the catalog (src/features/market/catalog.ts). */
export type TokenSymbol = string;

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
  /** False when no live price exists: value is unknown, not zero (shown as "—"). */
  priceAvailable?: boolean;
};

/** Token as listed on the market, independent of any holding. */
export type MarketToken = Pick<TokenHolding, 'symbol' | 'name' | 'mark' | 'color'> & {
  /** Latest CHF price; null when no price is available (shown as "—"). */
  priceChf: number | null;
  change24hPct: number | null;
};

export type Portfolio = {
  tokens: TokenHolding[];
  totalChf: number;
  changeTodayChf: number;
  changeTodayPct: number;
};

export type PriceRange = '1D' | '1W' | '1M' | '1Y' | 'ALL';

export type PricePoint = { value: number; label: string };

export type ActivityKind = 'send' | 'receive' | 'swap' | 'approve' | 'buy';
export type ActivityStatus = 'pending' | 'confirmed' | 'failed';

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  status: ActivityStatus;
  /** Shown next to "Pending" (e.g. "~ 30 sec"). */
  eta?: string;
  amount: string;
  /** Value in CHF, shown in the display currency; null if no price was available. */
  valueChf: number | null;
  /** The value is only the fee paid (e.g. token approvals). */
  valueIsFee?: boolean;
  /** Unix ms; used for grouping by day. */
  timestamp: number;
  /** On-chain transaction hash; absent for demo or not-yet-broadcast items. */
  hash?: string;
  /** ERC-4337 user operation hash of a gasless send; `hash` is filled in once
   * the bundler gets it mined. */
  userOpHash?: string;
  /** Index of the wallet account that made or received it. */
  accountIndex: number;
  networkId: NetworkId;
  /** Recipient (send), sender (receive) or approved spender (approve). */
  counterparty?: { label?: string; address: Address };
  /** Network fee: native amount (e.g. "0.00042 ETH") and its CHF value. */
  fee?: { native?: string; chf: number | null };
  swap?: { paid: string; received: string; rate: string; minReceived: string };
  purchase?: { paid: string; price: string; paymentMethod: string; fee: string };
  failureReason?: string;
  /** Set when this send is a deposit to the linked Swissquote account — tells
   * the confirmation poller to notify the mock server once it's mined. */
  swissquoteCustomerId?: string;
};

export type Contact = { name: string; address: Address };

/** A dApp the wallet has approved a session with (e.g. over WalletConnect). */
export type ConnectedSite = {
  id: string;
  name: string;
  /** Hostname shown to the user, e.g. `app.uniswap.org`. */
  host: string;
  networkId: NetworkId;
  /** Unix ms. */
  connectedAt: number;
};

export type FeeSpeed = 'low' | 'market' | 'fast';
