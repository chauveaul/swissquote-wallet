import { decodeFunctionData, erc20Abi, formatEther, formatUnits, maxUint256, type Address, type Hex } from 'viem';

import { erc20AssetFor, ERC20_DECIMALS } from '@/lib/erc20';
import { formatNumber, truncateAddress } from '@/lib/format';
import { getNetwork, type NetworkId } from '@/lib/networks';
import { publicClient } from '@/services/chain';

export type SimulationKind =
  | 'native-transfer'
  | 'token-transfer'
  | 'token-approve'
  | 'unlimited-approve'
  | 'contract-call'
  | 'contract-creation';

export type SimulationResult = {
  kind: SimulationKind;
  /** Plain-language description of what signing this would do. */
  summary: string;
  /** The address that would actually gain control of funds or spending rights — what sanctions screening checks, not necessarily `to`. */
  screenTarget: Address | null;
  /** CHF value moved or put at risk; null when it can't be computed (treated as "could be anything" for the threshold check). */
  valueChf: number | null;
  willRevert: boolean;
  revertReason: string | null;
};

type SimulateParams = {
  networkId: NetworkId;
  from: Address;
  to: Address | null;
  value: bigint;
  data: Hex | undefined;
  /** Spot price lookup (CHF per unit), e.g. `(symbol) => quotes.bySymbol.get(symbol)?.price ?? null`. */
  priceChf: (symbol: string) => number | null;
};

/**
 * Decodes a dApp's signing request into a plain-language summary and checks
 * whether it would revert on-chain, both before the user is asked to sign —
 * the brief's "simulating a transaction... before signing". This is a
 * best-effort decode (plain transfer/approve plus a revert check via
 * `estimateGas`), not a full state-diff simulator: an opaque multicall still
 * only shows the contract it talks to, not everything it does internally.
 */
export async function simulateRequest({ networkId, from, to, value, data, priceChf }: SimulateParams): Promise<SimulationResult> {
  const nativeSymbol = getNetwork(networkId).chain.nativeCurrency.symbol;
  let kind: SimulationKind = 'contract-call';
  let summary: string;
  let screenTarget: Address | null = to;
  let valueChf: number | null = null;

  if (to === null) {
    kind = 'contract-creation';
    summary = 'This will deploy a new contract from your wallet.';
  } else if (!data || data === '0x') {
    kind = 'native-transfer';
    const amount = Number(formatEther(value));
    summary = `Send ${formatNumber(amount, 5)} ${nativeSymbol} to ${truncateAddress(to)}.`;
    const price = priceChf(nativeSymbol);
    valueChf = price === null ? null : amount * price;
  } else {
    try {
      const decoded = decodeFunctionData({ abi: erc20Abi, data });
      const asset = erc20AssetFor(networkId, to);
      const label = asset ?? `token ${truncateAddress(to)}`;
      const decimals = asset ? ERC20_DECIMALS[asset] : 18;

      if (decoded.functionName === 'transfer') {
        const [recipient, amount] = decoded.args;
        kind = 'token-transfer';
        const amountNum = Number(formatUnits(amount, decimals));
        summary = `Send ${formatNumber(amountNum, 4)} ${label} to ${truncateAddress(recipient)}.`;
        screenTarget = recipient;
        const price = asset ? priceChf(asset) : null;
        valueChf = price === null ? null : amountNum * price;
      } else if (decoded.functionName === 'approve') {
        const [spender, amount] = decoded.args;
        screenTarget = spender;
        if (amount >= maxUint256 / 2n) {
          kind = 'unlimited-approve';
          summary = `Grant ${truncateAddress(spender)} unlimited access to your ${label}, now and in the future.`;
          valueChf = null; // unlimited is always treated as above any threshold
        } else {
          kind = 'token-approve';
          const amountNum = Number(formatUnits(amount, decimals));
          summary = `Allow ${truncateAddress(spender)} to spend up to ${formatNumber(amountNum, 4)} ${label} from your wallet.`;
          const price = asset ? priceChf(asset) : null;
          valueChf = price === null ? null : amountNum * price;
        }
      } else {
        summary = `This will call "${decoded.functionName}" on ${truncateAddress(to)}.`;
      }
    } catch {
      summary = `This will call a contract at ${truncateAddress(to)} (method ${data.slice(0, 10)}) — its effect can't be decoded.`;
    }
  }

  let willRevert = false;
  let revertReason: string | null = null;
  try {
    await publicClient(networkId).estimateGas({ account: from, to: to ?? undefined, value, data });
  } catch (e) {
    willRevert = true;
    revertReason = e instanceof Error ? e.message.split('\n')[0]! : 'This transaction would fail on-chain.';
  }

  return { kind, summary, screenTarget, valueChf, willRevert, revertReason };
}
