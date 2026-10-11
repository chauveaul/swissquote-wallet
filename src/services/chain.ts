import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatEther,
  formatUnits,
  http,
  parseEther,
  parseUnits,
  type Address,
  type Hash,
  type HDAccount,
} from 'viem';

import type { FeeSpeed, TransferAsset } from '@/features/market/types';
import { ERC20_DECIMALS, erc20Address } from '@/lib/erc20';
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

export async function getAssetBalance(networkId: NetworkId, asset: TransferAsset, owner: Address) {
  if (asset === 'ETH') return getNativeBalance(networkId, owner);
  const token = erc20Address(networkId, asset);
  if (!token) return { wei: 0n, formatted: '0' };
  const raw = await publicClient(networkId).readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [owner] });
  return { wei: raw, formatted: formatUnits(raw, ERC20_DECIMALS[asset]) };
}

type SendAssetParams = {
  signer: HDAccount;
  networkId: NetworkId;
  asset: TransferAsset;
  to: Address;
  amount: string;
  speed: FeeSpeed;
};

/** Gas limit per asset, same fixed-estimate convention `useFeeEstimate` already uses for ETH (21000) — not simulated against the sender's current state, which can misleadingly fail before a wallet is even funded. */
const GAS_LIMIT: Record<TransferAsset, bigint> = { ETH: 21_000n, USDC: 70_000n, LINK: 70_000n };

export async function estimateTransferFee(networkId: NetworkId, asset: TransferAsset, speed: FeeSpeed) {
  const fees = await estimateFees(networkId, speed);
  const feeWei = fees.maxFeePerGas * GAS_LIMIT[asset];
  return { feeWei, feeEth: Number(formatEther(feeWei)) };
}

/** Sends native ETH or one of the supported ERC-20s, whichever `asset` names. */
export async function sendAsset({ signer, networkId, asset, to, amount, speed }: SendAssetParams): Promise<Hash> {
  if (asset === 'ETH') return sendNative({ signer, networkId, to, amount, speed });
  const token = erc20Address(networkId, asset);
  if (!token) throw new Error(`${asset} isn't wired up on this network yet.`);
  const chain = getNetwork(networkId).chain;
  const client = createWalletClient({ account: signer, chain, transport: http(rpcUrl(networkId)) });
  const fees = await estimateFees(networkId, speed);
  return client.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [to, parseUnits(amount, ERC20_DECIMALS[asset])],
    ...fees,
  });
}
