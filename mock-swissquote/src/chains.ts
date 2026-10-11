import { createPublicClient, createWalletClient, http, type Chain, type LocalAccount } from 'viem';
import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  mainnet,
  optimism,
  optimismSepolia,
  polygon,
  polygonAmoy,
  sepolia,
} from 'viem/chains';

/**
 * Deliberately duplicated from the app's `src/lib/networks.ts` rather than
 * imported across packages — this server is its own process with its own
 * dependencies, by design (see README). Same network ids, same chains.
 */
export type NetworkId =
  | 'eth'
  | 'arb'
  | 'op'
  | 'base'
  | 'pol'
  | 'sepolia'
  | 'arbSepolia'
  | 'opSepolia'
  | 'baseSepolia'
  | 'polAmoy';

const CHAINS: Record<NetworkId, { chain: Chain; rpc: string }> = {
  eth: { chain: mainnet, rpc: 'https://eth.llamarpc.com' },
  arb: { chain: arbitrum, rpc: 'https://arb1.arbitrum.io/rpc' },
  op: { chain: optimism, rpc: 'https://mainnet.optimism.io' },
  base: { chain: base, rpc: 'https://mainnet.base.org' },
  pol: { chain: polygon, rpc: 'https://polygon-rpc.com' },
  sepolia: { chain: sepolia, rpc: 'https://ethereum-sepolia-rpc.publicnode.com' },
  arbSepolia: { chain: arbitrumSepolia, rpc: arbitrumSepolia.rpcUrls.default.http[0]! },
  opSepolia: { chain: optimismSepolia, rpc: optimismSepolia.rpcUrls.default.http[0]! },
  baseSepolia: { chain: baseSepolia, rpc: baseSepolia.rpcUrls.default.http[0]! },
  polAmoy: { chain: polygonAmoy, rpc: polygonAmoy.rpcUrls.default.http[0]! },
};

function entry(id: NetworkId) {
  const found = CHAINS[id];
  if (!found) throw new Error(`Unknown network: ${id}`);
  return found;
}

export function publicClientFor(id: NetworkId) {
  const { chain, rpc } = entry(id);
  return createPublicClient({ chain, transport: http(rpc) });
}

export function walletClientFor(id: NetworkId, account: LocalAccount) {
  const { chain, rpc } = entry(id);
  return createWalletClient({ account, chain, transport: http(rpc) });
}

export function isNetworkId(id: unknown): id is NetworkId {
  return typeof id === 'string' && id in CHAINS;
}

export function chainIdFor(id: NetworkId): number {
  return entry(id).chain.id;
}
