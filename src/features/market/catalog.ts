import { colors } from '@/theme/tokens';

import type { TokenSymbol } from './types';

/**
 * Every cryptocurrency Swissquote offers, as listed by Swissquote's market-quote
 * service (snapshot of 10 Oct 2026, 55 assets). Quoted in USD on
 * Swissquote's crypto venue (exchange id 31337) and converted to CHF in the app.
 *
 * To update: the identifiers are embedded in swissquote.com's cryptocurrencies
 * product page; `npm run check:prices` flags any that stop returning a price.
 */
export type CatalogAsset = { symbol: TokenSymbol; name: string; isin: string };

export const SWISSQUOTE_CRYPTO_EXCHANGE = 31337;
export const SWISSQUOTE_CRYPTO_CURRENCY = 'USD';

export const CRYPTO_CATALOG: readonly CatalogAsset[] = [
  { symbol: 'AAVE', name: 'Aave', isin: 'EX0X00AAV000' },
  { symbol: 'ADA', name: 'Cardano', isin: 'EX0X00ADA000' },
  { symbol: 'ALGO', name: 'Algorand', isin: 'EX0X00ALG000' },
  { symbol: 'APE', name: 'ApeCoin', isin: 'EX0X00APE000' },
  { symbol: 'ARB', name: 'Arbitrum', isin: 'EX0X00ARB000' },
  { symbol: 'ATOM', name: 'Cosmos', isin: 'EX0X00ATM000' },
  { symbol: 'AUDIO', name: 'Audius', isin: 'EX0X00ADI000' },
  { symbol: 'AVAX', name: 'Avalanche', isin: 'EX0X00VAX000' },
  { symbol: 'AXS', name: 'Axie Infinity', isin: 'EX0X00AXS000' },
  { symbol: 'BCH', name: 'Bitcoin cash', isin: 'EX0X00BCH000' },
  { symbol: 'BNT', name: 'Bancor', isin: 'EX0X00BNT000' },
  { symbol: 'BONK', name: 'Bonk', isin: 'EX0X00BNK000' },
  { symbol: 'BTC', name: 'Bitcoin', isin: 'EX0X00XBT000' },
  { symbol: 'CHZ', name: 'Chiliz', isin: 'EX0X00CHZ000' },
  { symbol: 'COMP', name: 'Compound', isin: 'EX0X00COM000' },
  { symbol: 'CRV', name: 'Curve DAO Token', isin: 'EX0X00CRV000' },
  { symbol: 'DOGE', name: 'Dogecoin', isin: 'EX0X00XDG000' },
  { symbol: 'DOT', name: 'Polkadot', isin: 'EX0X00DOT000' },
  { symbol: 'ENA', name: 'Ethena', isin: 'EX0X00ENA000' },
  { symbol: 'ENS', name: 'Ethereum Name Service', isin: 'EX0X00ENS000' },
  { symbol: 'ETH', name: 'Ethereum', isin: 'EX0X00ETH000' },
  { symbol: 'EURC', name: 'EURC', isin: 'EX0X00EUC000' },
  { symbol: 'FET', name: 'Artificial Superintelligence Alliance', isin: 'EX0X00FET000' },
  { symbol: 'FIL', name: 'Filecoin', isin: 'EX0X00FIL000' },
  { symbol: 'FLOKI', name: 'FLOKI', isin: 'EX0X00FLK000' },
  { symbol: 'GALA', name: 'Gala', isin: 'EX0X00GAL000' },
  { symbol: 'GRT', name: 'The Graph', isin: 'EX0X00GRT000' },
  { symbol: 'HBAR', name: 'Hedera Hashgraph', isin: 'EX0X00HBR000' },
  { symbol: 'ICP', name: 'Internet Computer', isin: 'EX0X00ICP000' },
  { symbol: 'IMX', name: 'Immutable', isin: 'EX0X00IMX000' },
  { symbol: 'LDO', name: 'Lido DAO', isin: 'EX0X00LDO000' },
  { symbol: 'LINK', name: 'Chainlink', isin: 'EX0X00LNK000' },
  { symbol: 'LTC', name: 'Litecoin', isin: 'EX0X00LTC000' },
  { symbol: 'MANA', name: 'Decentraland', isin: 'EX0X00MAN000' },
  { symbol: 'MELANIA', name: 'Melania Meme', isin: 'EX0X00MLN000' },
  { symbol: 'MNT', name: 'Mantle', isin: 'EX0X00MNE000' },
  { symbol: 'NEAR', name: 'NEAR Protocol', isin: 'EX0X00NEA000' },
  { symbol: 'ONDO', name: 'Ondo', isin: 'EX0X00OND000' },
  { symbol: 'PEPE', name: 'Pepe', isin: 'EX0X00PEP000' },
  { symbol: 'POL', name: 'POL (ex-MATIC)', isin: 'EX0X00POL000' },
  { symbol: 'RENDER', name: 'Render', isin: 'EX0X00REN000' },
  { symbol: 'SAND', name: 'Sandbox', isin: 'EX0X00SAN000' },
  { symbol: 'SHIB', name: 'Shiba Inu', isin: 'EX0X00SHI000' },
  { symbol: 'SKY', name: 'Sky', isin: 'EX0X00SKY000' },
  { symbol: 'SOL', name: 'Solana', isin: 'EX0X00SOL000' },
  { symbol: 'TAO', name: 'Bittensor', isin: 'EX0X00TAO000' },
  { symbol: 'TRUMP', name: 'OFFICIAL TRUMP', isin: 'EX0X00TRP000' },
  { symbol: 'UNI', name: 'Uniswap', isin: 'EX0X00UNI000' },
  { symbol: 'USDC', name: 'USDC', isin: 'EX0X00UDC000' },
  { symbol: 'USDT', name: 'Tether', isin: 'EX0X00UDT000' },
  { symbol: 'WIF', name: 'dogwifhat', isin: 'EX0X00WIF000' },
  { symbol: 'XLM', name: 'Stellar Lumens', isin: 'EX0X00XLM000' },
  { symbol: 'XRP', name: 'XRP', isin: 'EX0X00XRP000' },
  { symbol: 'XTZ', name: 'Tezos', isin: 'EX0X00XTZ000' },
  { symbol: 'ZRX', name: '0x', isin: 'EX0X00ZRX000' },
];

/**
 * Tokens this wallet can hold (Ethereum-network tokens it tracks). Other assets
 * can be browsed in Explore but not sent, received or bought into this wallet.
 * WBTC isn't listed by Swissquote; it is 1:1 backed by BTC and priced as BTC.
 */
export const WALLET_TOKENS: readonly TokenSymbol[] = ['ETH', 'WBTC', 'USDC', 'LINK'];
export const PRICE_AS: Readonly<Record<TokenSymbol, TokenSymbol>> = { WBTC: 'BTC' };

/**
 * Tokens accepted for transfer to/from a linked Swissquote account — not
 * WBTC. WBTC is a third-party-custodied wrapped claim on BTC (BitGo), not
 * BTC itself; accepting it means trusting BitGo's custody on top of
 * Swissquote's, a real due-diligence question a bank can't skip. USDC and
 * LINK are both plain, directly-held ERC-20s with no such issue.
 * (Execution today only covers ETH — see `services/swissquoteMock.ts` and
 * the README; USDC/LINK transfer support is a tracked follow-up, same as
 * ERC-20 sends generally.)
 */
export const SWISSQUOTE_ACCEPTED_TOKENS: readonly TokenSymbol[] = ['ETH', 'USDC', 'LINK'];
export const isSwissquoteAccepted = (symbol: TokenSymbol) => SWISSQUOTE_ACCEPTED_TOKENS.includes(symbol);

export const isWalletToken = (symbol: TokenSymbol) => WALLET_TOKENS.includes(symbol);

const NAMES: Readonly<Record<TokenSymbol, string>> = { WBTC: 'Wrapped Bitcoin', USDC: 'USD Coin' };

/** Display name: wallet-specific names first, then Swissquote's product name. */
export function assetName(symbol: TokenSymbol): string {
  return NAMES[symbol] ?? CRYPTO_CATALOG.find((a) => a.symbol === symbol)?.name ?? symbol;
}

/** Swissquote identifier for a symbol, following PRICE_AS (WBTC → BTC). */
export function catalogEntry(symbol: TokenSymbol): CatalogAsset | undefined {
  const target = PRICE_AS[symbol] ?? symbol;
  return CRYPTO_CATALOG.find((a) => a.symbol === target);
}

const KNOWN_COLORS: Readonly<Record<TokenSymbol, string>> = {
  ETH: colors.token.ETH,
  BTC: colors.token.WBTC,
  WBTC: colors.token.WBTC,
  USDC: colors.token.USDC,
  LINK: colors.token.LINK,
};
const PALETTE = ['#323232', '#8A5A12', '#2B5C9E', '#3A4A8C', '#1E7A4C', '#6B3A8C', '#8C3A4A', '#3A7A8C', '#5E5E5E', '#7A6A1E'];

/** Stable badge colour per token (design colours for the wallet's tokens). */
export function tokenColor(symbol: TokenSymbol): string {
  if (KNOWN_COLORS[symbol]) return KNOWN_COLORS[symbol]!;
  let h = 0;
  for (const ch of symbol) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

/** Badge label: the ticker, shortened to 4 characters ("RENDER" → "REND"). */
export const tokenMark = (symbol: TokenSymbol) => (symbol === 'WBTC' ? 'BTC' : symbol.slice(0, 4));
