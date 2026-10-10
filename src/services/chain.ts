import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseEther,
  type Address,
  type Hash,
  type HDAccount,
} from 'viem';

import type { FeeSpeed } from '@/features/market/types';
import { getNetwork, rpcUrl, type NetworkId } from '@/lib/networks';

/** EIP-1559 fee multipliers applied to the node's suggested fees. */
const SPEED_MULTIPLIER: Record<FeeSpeed, bigint> = { low: 90n, market: 100n, fast: 130n };

export function publicClient(networkId: NetworkId) {
  return createPublicClient({ chain: getNetwork(networkId).chain, transport: http(rpcUrl(networkId)) });
}

/** Reads the real on-chain native balance (ETH, or the network's native token). */
export async function getNativeBalance(networkId: NetworkId, address: Address) {
  const wei = await publicClient(networkId).getBalance({ address });
  return { wei, formatted: formatEther(wei) };
}

export async function estimateFees(networkId: NetworkId, speed: FeeSpeed) {
  const fees = await publicClient(networkId).estimateFeesPerGas();
  const m = SPEED_MULTIPLIER[speed];
  return {
    maxFeePerGas: (fees.maxFeePerGas * m) / 100n,
    maxPriorityFeePerGas: (fees.maxPriorityFeePerGas * m) / 100n,
  };
}

type SendNativeParams = {
  signer: HDAccount;
  networkId: NetworkId;
  to: Address;
  amount: string;
  speed: FeeSpeed;
};

/** Signs locally with the HD account and broadcasts a native-asset transfer. */
export async function sendNative({ signer, networkId, to, amount, speed }: SendNativeParams): Promise<Hash> {
  const chain = getNetwork(networkId).chain;
  const client = createWalletClient({ account: signer, chain, transport: http(rpcUrl(networkId)) });
  const fees = await estimateFees(networkId, speed);
  return client.sendTransaction({ to, value: parseEther(amount), ...fees });
}
