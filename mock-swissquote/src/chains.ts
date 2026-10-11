import { createPublicClient, createWalletClient, http, type Address, type Chain, type LocalAccount } from 'viem';
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

/**
 * ERC-20 addresses verified on-chain (symbol/decimals/name read back) before
 * being hardcoded — not guessed. Only Sepolia is filled in: USDC/LINK
 * addresses differ per network and weren't verified for the others, so
 * those are left unsupported rather than wrong. Native ETH needs no entry.
 */
export const ERC20: Partial<Record<NetworkId, Partial<Record<'USDC' | 'LINK', Address>>>> = {
  sepolia: {
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    LINK: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
  },
};

export function erc20Address(id: NetworkId, token: 'USDC' | 'LINK'): Address | undefined {
  return ERC20[id]?.[token];
}

/** Standard decimals for these tokens (verified on-chain alongside the addresses above). */
export const ERC20_DECIMALS: Record<'USDC' | 'LINK', number> = { USDC: 6, LINK: 18 };

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
