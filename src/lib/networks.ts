import type { Chain } from 'viem';
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

export type Network = {
  id: NetworkId;
  /** Single-letter mark shown in the network badge. */
  mark: string;
  name: string;
  /** Short name used in the home network switcher. */
  shortName: string;
  chain: Chain;
};

export const networks: readonly Network[] = [
  { id: 'eth', mark: 'E', name: 'Ethereum Mainnet', shortName: 'Ethereum', chain: mainnet },
  { id: 'arb', mark: 'A', name: 'Arbitrum One', shortName: 'Arbitrum', chain: arbitrum },
  { id: 'op', mark: 'O', name: 'OP Mainnet', shortName: 'Optimism', chain: optimism },
  { id: 'base', mark: 'B', name: 'Base', shortName: 'Base', chain: base },
  { id: 'pol', mark: 'P', name: 'Polygon PoS', shortName: 'Polygon', chain: polygon },
  // Testnets, for dry-running real signing/broadcast without risking mainnet funds.
  { id: 'sepolia', mark: 'S', name: 'Sepolia (testnet)', shortName: 'Sepolia', chain: sepolia },
  { id: 'arbSepolia', mark: 'AS', name: 'Arbitrum Sepolia (testnet)', shortName: 'Arb. Sepolia', chain: arbitrumSepolia },
  { id: 'opSepolia', mark: 'OS', name: 'OP Sepolia (testnet)', shortName: 'OP Sepolia', chain: optimismSepolia },
  { id: 'baseSepolia', mark: 'BS', name: 'Base Sepolia (testnet)', shortName: 'Base Sepolia', chain: baseSepolia },
  { id: 'polAmoy', mark: 'PA', name: 'Polygon Amoy (testnet)', shortName: 'Amoy', chain: polygonAmoy },
];

export function getNetwork(id: NetworkId): Network {
  const network = networks.find((n) => n.id === id);
  if (!network) throw new Error(`Unknown network: ${id}`);
  return network;
}

/**
 * RPC endpoint per network. Configure production endpoints (with your provider
 * key) through `EXPO_PUBLIC_RPC_URL_<ID>`; falls back to the chain's public RPC.
 */
export function rpcUrl(id: NetworkId): string {
  const env: Record<NetworkId, string | undefined> = {
    eth: process.env.EXPO_PUBLIC_RPC_URL_ETH,
    arb: process.env.EXPO_PUBLIC_RPC_URL_ARB,
    op: process.env.EXPO_PUBLIC_RPC_URL_OP,
    base: process.env.EXPO_PUBLIC_RPC_URL_BASE,
    pol: process.env.EXPO_PUBLIC_RPC_URL_POL,
    sepolia: process.env.EXPO_PUBLIC_RPC_URL_SEPOLIA,
    arbSepolia: process.env.EXPO_PUBLIC_RPC_URL_ARB_SEPOLIA,
    opSepolia: process.env.EXPO_PUBLIC_RPC_URL_OP_SEPOLIA,
    baseSepolia: process.env.EXPO_PUBLIC_RPC_URL_BASE_SEPOLIA,
    polAmoy: process.env.EXPO_PUBLIC_RPC_URL_POL_AMOY,
  };
  return env[id] ?? getNetwork(id).chain.rpcUrls.default.http[0]!;
}
