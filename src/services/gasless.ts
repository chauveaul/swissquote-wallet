import {
  createWalletClient,
  http,
  parseEther,
  type Address,
  type Hash,
  type HDAccount,
  type PrivateKeyAccount,
} from 'viem';
import {
  createBundlerClient,
  createPaymasterClient,
  toSimple7702SmartAccount,
  type BundlerClient,
} from 'viem/account-abstraction';

import { DEMO_MODE } from '@/lib/config';
import { getNetwork, rpcUrl, type NetworkId } from '@/lib/networks';
import { publicClient } from '@/services/chain';

/**
 * Gasless sends, the way MetaMask does them since Pectra: the user's existing
 * EOA is upgraded in place with an EIP-7702 delegation to a smart-account
 * implementation, and the transfer is submitted as an ERC-4337 user operation
 * whose gas a paymaster pays. Same address, same key, no ETH needed for gas.
 *
 * - Implementation: eth-infinitism's audited `Simple7702Account` (EntryPoint
 *   v0.8), built into viem — no extra SDK.
 * - First gasless send also carries the signed 7702 authorization; later ones
 *   don't (the delegation persists until the user revokes it).
 * - An account already delegated to someone else's implementation (e.g. it was
 *   upgraded in MetaMask) is never re-delegated silently: it just falls back
 *   to paying gas in ETH.
 *
 * Configure with `EXPO_PUBLIC_BUNDLER_URL` (`{chainId}` is substituted, e.g.
 * `https://api.pimlico.io/v2/{chainId}/rpc?apikey=…`), optionally
 * `EXPO_PUBLIC_PAYMASTER_URL` (defaults to the bundler URL) and
 * `EXPO_PUBLIC_SPONSORSHIP_POLICY_ID`. In production point these at a
 * Swissquote proxy that holds the provider key and enforces limits — anything
 * `EXPO_PUBLIC_` ships inside the app.
 */

const BUNDLER_URL = process.env.EXPO_PUBLIC_BUNDLER_URL;
const PAYMASTER_URL = process.env.EXPO_PUBLIC_PAYMASTER_URL || BUNDLER_URL;
const SPONSORSHIP_POLICY_ID = process.env.EXPO_PUBLIC_SPONSORSHIP_POLICY_ID;

/** `Simple7702Account` for EntryPoint v0.8 (viem's default for `toSimple7702SmartAccount`). */
export const SIMPLE_7702_IMPLEMENTATION: Address = '0xe6Cae83BdE06E4c305530e199D7217f42808555B';

/** EIP-7702 delegation designator: `0xef0100 ‖ address`. */
const DELEGATION_PREFIX = '0xef0100';

export function gaslessConfigured(): boolean {
  return !DEMO_MODE && Boolean(BUNDLER_URL);
}

function endpoint(template: string, networkId: NetworkId): string {
  return template.replaceAll('{chainId}', String(getNetwork(networkId).chain.id));
}

/** Where an address' code points: plain EOA, our delegation, someone else's, or a contract. */
export type DelegationState = 'none' | 'ours' | 'other' | 'contract';

export function delegationState(code: string | undefined): DelegationState {
  if (!code || code === '0x') return 'none';
  const lower = code.toLowerCase();
  if (!lower.startsWith(DELEGATION_PREFIX) || lower.length !== 48) return 'contract';
  return `0x${lower.slice(8)}` === SIMPLE_7702_IMPLEMENTATION.toLowerCase() ? 'ours' : 'other';
}

/** Bundler for receipts only (no account), e.g. for the activity poller. */
export function bundlerClient(networkId: NetworkId): BundlerClient {
  if (!BUNDLER_URL) throw new Error('No bundler configured');
  return createBundlerClient({
    chain: getNetwork(networkId).chain,
    client: publicClient(networkId),
    transport: http(endpoint(BUNDLER_URL, networkId)),
  });
}

async function smartAccountFor(signer: HDAccount, networkId: NetworkId) {
  const client = publicClient(networkId);
  const account = await toSimple7702SmartAccount({
    client,
    // An HD account is a private-key account with derivation info on top.
    owner: signer as unknown as PrivateKeyAccount,
    implementation: SIMPLE_7702_IMPLEMENTATION,
  });
  const bundler = createBundlerClient({
    account,
    chain: getNetwork(networkId).chain,
    client,
    transport: http(endpoint(BUNDLER_URL!, networkId)),
    paymaster: createPaymasterClient({ transport: http(endpoint(PAYMASTER_URL!, networkId)) }),
    paymasterContext: SPONSORSHIP_POLICY_ID ? { sponsorshipPolicyId: SPONSORSHIP_POLICY_ID } : undefined,
    userOperation: {
      // Bundlers reject user operations priced below their own floor, so ask
      // them first; fall back to the node's estimate for bundlers without it.
      estimateFeesPerGas: async ({ bundlerClient }) => {
        try {
          const prices = (await bundlerClient.request({
            method: 'pimlico_getUserOperationGasPrice',
          } as never)) as { fast: { maxFeePerGas: string; maxPriorityFeePerGas: string } };
          return {
            maxFeePerGas: BigInt(prices.fast.maxFeePerGas),
            maxPriorityFeePerGas: BigInt(prices.fast.maxPriorityFeePerGas),
          };
        } catch {
          return client.estimateFeesPerGas();
        }
      },
    },
  });
  return { account, bundler, client };
}

export type Sponsorship = { sponsored: true } | { sponsored: false; reason: string };

/**
 * Asks the paymaster whether it would sponsor a send from this account right
 * now (dry run: nothing is signed or broadcast). The probe is a zero-value
 * self-call so it doesn't depend on what the user is typing; the real send is
 * sponsored again from scratch at confirmation.
 */
export async function checkSponsorship(signer: HDAccount, networkId: NetworkId): Promise<Sponsorship> {
  if (!gaslessConfigured()) return { sponsored: false, reason: 'Gasless sends are not configured.' };
  const { account, bundler, client } = await smartAccountFor(signer, networkId);
  const state = delegationState(await client.getCode({ address: signer.address }));
  if (state === 'other') {
    return { sponsored: false, reason: 'This account is delegated to another smart account (e.g. by another wallet).' };
  }
  if (state === 'contract') return { sponsored: false, reason: 'This address is a contract.' };
  try {
    const op = await bundler.prepareUserOperation({
      account,
      calls: [{ to: signer.address, value: 0n }],
    });
    return op.paymaster
      ? { sponsored: true }
      : { sponsored: false, reason: 'The paymaster declined to sponsor this transaction.' };
  } catch (e) {
    return { sponsored: false, reason: firstLine(e) };
  }
}

type SendGaslessParams = { signer: HDAccount; networkId: NetworkId; to: Address; amount: string };

/**
 * Signs and submits a sponsored native transfer. Returns the user operation
 * hash straight away; the bundler puts it in a transaction a few seconds later
 * (see {@link getGaslessReceipt}).
 */
export async function sendNativeGasless({ signer, networkId, to, amount }: SendGaslessParams): Promise<Hash> {
  const { account, bundler, client } = await smartAccountFor(signer, networkId);
  const state = delegationState(await client.getCode({ address: signer.address }));
  if (state === 'other' || state === 'contract') {
    throw new Error('This account can’t send gasless transactions. Pay the network fee in ETH instead.');
  }

  // First use: authorize the upgrade. The bundler, not this EOA, sends the
  // outer transaction, so the authorization uses the EOA's current nonce.
  const authorization =
    state === 'none'
      ? await createWalletClient({
          account: signer,
          chain: getNetwork(networkId).chain,
          transport: http(rpcUrl(networkId)),
        }).signAuthorization({ contractAddress: SIMPLE_7702_IMPLEMENTATION })
      : undefined;

  return bundler.sendUserOperation({
    account,
    calls: [{ to, value: parseEther(amount) }],
    authorization,
  });
}

/**
 * Receipt of a user operation once mined: the bundle's transaction hash and
 * whether the call itself succeeded. `null` while it's still waiting.
 */
export async function getGaslessReceipt(
  networkId: NetworkId,
  userOpHash: Hash,
): Promise<{ transactionHash: Hash; success: boolean } | null> {
  try {
    const receipt = await bundlerClient(networkId).getUserOperationReceipt({ hash: userOpHash });
    return { transactionHash: receipt.receipt.transactionHash, success: receipt.success };
  } catch {
    return null;
  }
}

function firstLine(e: unknown): string {
  return e instanceof Error ? e.message.split('\n')[0]! : 'Sponsorship is unavailable.';
}
