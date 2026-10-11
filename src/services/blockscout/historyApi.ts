/**
 * Transaction history from Blockscout's public explorer API
 * (https://docs.blockscout.com/devs/apis/rest). A JSON-RPC node can't list an
 * address's incoming transfers, so history needs an indexer; Blockscout is
 * free, needs no key and covers every network the wallet supports.
 *
 * Only the latest page (50 transactions) of native-asset transactions is read.
 * Token transfers and internal transactions (ETH sent by a contract) are not.
 */
import type { Address, Hash } from 'viem';

import type { NetworkId } from '@/lib/networks';

import { fetchWithTimeout } from '../marketData';

// Arbitrum Sepolia and Polygon Amoy have no public Blockscout API, so their
// history is empty; sends from this device still show from local activity.
const HOSTS: Partial<Record<NetworkId, string>> = {
  eth: 'eth.blockscout.com',
  arb: 'arbitrum.blockscout.com',
  // optimism.blockscout.com redirects here without CORS headers.
  op: 'explorer.optimism.io',
  base: 'base.blockscout.com',
  pol: 'polygon.blockscout.com',
  sepolia: 'eth-sepolia.blockscout.com',
  // optimism-sepolia.blockscout.com redirects here.
  opSepolia: 'testnet-explorer.optimism.io',
  baseSepolia: 'base-sepolia.blockscout.com',
};

const TIMEOUT_MS = 10_000;

export type ChainTx = {
  hash: Hash;
  /** Unix ms. */
  timestamp: number;
  from: Address;
  /** Null for contract creation. */
  to: Address | null;
  value: bigint;
  feeWei: bigint;
  status: 'pending' | 'confirmed' | 'failed';
};

type RawTx = {
  hash?: unknown;
  timestamp?: unknown;
  from?: { hash?: unknown } | null;
  to?: { hash?: unknown } | null;
  value?: unknown;
  fee?: { value?: unknown } | null;
  status?: unknown;
  result?: unknown;
};

const isHex = (v: unknown): v is `0x${string}` => typeof v === 'string' && /^0x[0-9a-fA-F]+$/.test(v);

function toBigInt(v: unknown): bigint {
  return typeof v === 'string' && /^\d+$/.test(v) ? BigInt(v) : 0n;
}

/** Validates one Blockscout transaction; null if it can't be shown. Exported for tests. */
export function parseTransaction(raw: RawTx): ChainTx | null {
  if (!isHex(raw.hash) || !isHex(raw.from?.hash)) return null;
  const time = typeof raw.timestamp === 'string' ? Date.parse(raw.timestamp) : NaN;
  const status = raw.status === 'ok' ? 'confirmed' : raw.status === 'error' ? 'failed' : 'pending';
  return {
    hash: raw.hash,
    timestamp: Number.isFinite(time) ? time : Date.now(),
    from: raw.from.hash as Address,
    to: isHex(raw.to?.hash) ? (raw.to.hash as Address) : null,
    value: toBigInt(raw.value),
    feeWei: toBigInt(raw.fee?.value),
    status,
  };
}

/** Latest transactions sent from or to `address`, newest first. */
export async function fetchTransactions(networkId: NetworkId, address: Address, signal?: AbortSignal): Promise<ChainTx[]> {
  const host = HOSTS[networkId];
  if (!host) return [];
  const url = `https://${host}/api/v2/addresses/${address}/transactions`;
  const res = await fetchWithTimeout(url, { signal, headers: { accept: 'application/json' } }, TIMEOUT_MS, 'Blockscout');
  const body = (await res.json()) as { items?: unknown };
  if (!Array.isArray(body.items)) return [];
  return body.items.map((i) => parseTransaction(i as RawTx)).filter((t): t is ChainTx => t !== null);
}

export type ChainTokenTransfer = {
  hash: Hash;
  timestamp: number;
  from: Address;
  to: Address;
  tokenAddress: Address;
  /** Raw integer amount, not yet divided by the token's decimals. */
  rawValue: bigint;
};

type RawTokenTransfer = {
  tx_hash?: unknown;
  timestamp?: unknown;
  from?: { hash?: unknown } | null;
  to?: { hash?: unknown } | null;
  token?: { address?: unknown } | null;
  total?: { value?: unknown } | null;
};

/** Validates one Blockscout token-transfer entry; null if it can't be shown. Exported for tests. */
export function parseTokenTransfer(raw: RawTokenTransfer): ChainTokenTransfer | null {
  if (!isHex(raw.tx_hash) || !isHex(raw.from?.hash) || !isHex(raw.to?.hash) || !isHex(raw.token?.address)) return null;
  const time = typeof raw.timestamp === 'string' ? Date.parse(raw.timestamp) : NaN;
  return {
    hash: raw.tx_hash,
    timestamp: Number.isFinite(time) ? time : Date.now(),
    from: raw.from.hash as Address,
    to: raw.to.hash as Address,
    tokenAddress: raw.token.address as Address,
    rawValue: toBigInt(raw.total?.value),
  };
}

/**
 * Latest ERC-20 transfers into or out of `address`, newest first. Native
 * transactions come from {@link fetchTransactions} instead — Blockscout
 * reports the two separately.
 */
export async function fetchTokenTransfers(
  networkId: NetworkId,
  address: Address,
  signal?: AbortSignal,
): Promise<ChainTokenTransfer[]> {
  const host = HOSTS[networkId];
  if (!host) return [];
  const url = `https://${host}/api/v2/addresses/${address}/token-transfers?type=ERC-20`;
  const res = await fetchWithTimeout(url, { signal, headers: { accept: 'application/json' } }, TIMEOUT_MS, 'Blockscout');
  const body = (await res.json()) as { items?: unknown };
  if (!Array.isArray(body.items)) return [];
  return body.items.map((i) => parseTokenTransfer(i as RawTokenTransfer)).filter((t): t is ChainTokenTransfer => t !== null);
}
