import type { Address } from 'viem';

import type { NetworkId } from './networks';

/**
 * ERC-20 addresses verified on-chain (symbol/decimals/name read back)
 * before being hardcoded — not guessed. Only Sepolia is filled in: USDC and
 * LINK addresses differ per network and weren't verified for the others,
 * so those stay unsupported rather than wrong. Mirrors
 * `mock-swissquote/src/chains.ts`'s own copy of this table — deliberately
 * duplicated rather than shared, since that server is its own process.
 */
export const ERC20: Partial<Record<NetworkId, Partial<Record<'USDC' | 'LINK', Address>>>> = {
  sepolia: {
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    LINK: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
  },
};

export const ERC20_DECIMALS: Record<'USDC' | 'LINK', number> = { USDC: 6, LINK: 18 };

export function erc20Address(id: NetworkId, token: 'USDC' | 'LINK'): Address | undefined {
  return ERC20[id]?.[token];
}

/** Which of our supported ERC-20s a token address is on this network, if any. */
export function erc20AssetFor(networkId: NetworkId, tokenAddress: Address): 'USDC' | 'LINK' | null {
  const tokens = ERC20[networkId];
  if (!tokens) return null;
  const lower = tokenAddress.toLowerCase();
  if (tokens.USDC?.toLowerCase() === lower) return 'USDC';
  if (tokens.LINK?.toLowerCase() === lower) return 'LINK';
  return null;
}
