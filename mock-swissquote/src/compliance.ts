import { createPublicClient, getAddress, http, parseAbi, type Address, type Hex } from 'viem';
import { mainnet } from 'viem/chains';
import { createSiweMessage, generateSiweNonce } from 'viem/siwe';

import { publicClientFor, type NetworkId } from './chains.ts';

/**
 * The compliance checks a Swiss bank applies at the boundary between its
 * custody and a customer's self-custody wallet (FINMA Guidance 02/2019,
 * AMLA/AMLO-FINMA, SECO sanctions):
 *
 * 1. Ownership proof — the customer signs a server-issued, single-use,
 *    expiring Sign-In with Ethereum (EIP-4361) challenge bound to their
 *    account; verified with EIP-1271/6492 support.
 * 2. Control check — on every link, deposit and withdrawal, on that network:
 *    the address must still be one only the customer's key controls (a plain
 *    EOA, or an EOA whose EIP-7702 delegation is to an approved contract).
 * 3. Sanctions screening — every counterparty address, fail-closed.
 */

// ---------------------------------------------------------------------------
// 1. Ownership proof (EIP-4361 challenge)
// ---------------------------------------------------------------------------

const SIWE_DOMAIN = process.env.SIWE_DOMAIN ?? 'wallet.swissquote.mock';
const CHALLENGE_TTL_MS = 5 * 60_000;

type Challenge = { customerId: string; address: Address; networkId: NetworkId; nonce: string; message: string; expiresAt: number };

/** In memory on purpose: a restart simply invalidates outstanding challenges. */
const challenges = new Map<string, Challenge>();

export function issueLinkChallenge(params: {
  customerId: string;
  accountNumber: string;
  address: string;
  networkId: NetworkId;
  chainId: number;
}): Challenge {
  const address = getAddress(params.address);
  const nonce = generateSiweNonce();
  const now = new Date();
  const expiresAt = now.getTime() + CHALLENGE_TTL_MS;
  const message = createSiweMessage({
    domain: SIWE_DOMAIN,
    uri: `https://${SIWE_DOMAIN}/link`,
    version: '1',
    address,
    chainId: params.chainId,
    nonce,
    issuedAt: now,
    expirationTime: new Date(expiresAt),
    requestId: params.customerId,
    statement:
      `I confirm that I alone control this wallet and link it to Swissquote account ${params.accountNumber}. ` +
      'Swissquote will only send withdrawals to this address.',
  });
  const challenge = { customerId: params.customerId, address, networkId: params.networkId, nonce, message, expiresAt };
  // One outstanding challenge per customer: a new request replaces the old one.
  challenges.set(params.customerId, challenge);
  return challenge;
}

/**
 * Consumes the customer's outstanding challenge (single use, even on failure)
 * and verifies the signature over exactly that message. Smart-account
 * signatures (EIP-1271, and EIP-6492 for not-yet-deployed ones) verify too.
 */
export async function verifyLinkChallenge(
  customerId: string,
  signature: Hex,
): Promise<{ ok: true; challenge: Challenge } | { ok: false; reason: string }> {
  const challenge = challenges.get(customerId);
  challenges.delete(customerId);
  if (!challenge) return { ok: false, reason: 'No link challenge pending. Request a new one.' };
  if (Date.now() > challenge.expiresAt) return { ok: false, reason: 'The link challenge expired. Request a new one.' };
  let valid = false;
  try {
    valid = await publicClientFor(challenge.networkId).verifySiweMessage({
      message: challenge.message,
      signature,
      address: challenge.address,
      domain: SIWE_DOMAIN,
      nonce: challenge.nonce,
    });
  } catch {
    valid = false;
  }
  return valid ? { ok: true, challenge } : { ok: false, reason: 'Signature does not match the challenge for this address.' };
}

// ---------------------------------------------------------------------------
// 2. Control check (EIP-7702 delegations and contract wallets)
// ---------------------------------------------------------------------------

/**
 * Delegation targets reviewed and approved: their code only acts on the EOA
 * key's signature, so the customer's sole control is preserved. Currently
 * eth-infinitism's Simple7702Account (EntryPoint v0.8), used by the wallet's
 * gasless sends. Others (e.g. MetaMask's delegator) can be added after review.
 */
export const APPROVED_7702_DELEGATES: readonly Address[] = ['0xe6Cae83BdE06E4c305530e199D7217f42808555B'];

export type ControlCheck =
  | { ok: true; kind: 'eoa' | 'eoa-7702'; delegate?: Address }
  | { ok: false; kind: 'eoa-7702' | 'contract'; delegate?: Address; reason: string };

export function classifyCode(code: Hex | undefined): ControlCheck {
  if (!code || code === '0x') return { ok: true, kind: 'eoa' };
  const lower = code.toLowerCase();
  if (lower.startsWith('0xef0100') && lower.length === 48) {
    const delegate = getAddress(`0x${lower.slice(8)}`);
    return APPROVED_7702_DELEGATES.some((a) => a.toLowerCase() === delegate.toLowerCase())
      ? { ok: true, kind: 'eoa-7702', delegate }
      : {
          ok: false,
          kind: 'eoa-7702',
          delegate,
          reason: `This address is delegated (EIP-7702) to an unreviewed contract ${delegate}, which may let others move its funds.`,
        };
  }
  return {
    ok: false,
    kind: 'contract',
    reason: 'Smart-contract wallets can’t be linked yet: sole control by one customer can’t be established from a signature alone.',
  };
}

export async function checkControl(networkId: NetworkId, address: string): Promise<ControlCheck> {
  return classifyCode(await publicClientFor(networkId).getCode({ address: getAddress(address) }));
}

// ---------------------------------------------------------------------------
// 3. Sanctions screening
// ---------------------------------------------------------------------------

export class ScreeningUnavailableError extends Error {}

/** Chainalysis' free on-chain sanctions oracle (OFAC SDN crypto addresses), Ethereum mainnet. */
const SANCTIONS_ORACLE: Address = '0x40C57923924B5c5c5455c48D93317139ADDaC8fb';
const oracleAbi = parseAbi(['function isSanctioned(address addr) view returns (bool)']);
const oracleClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.SANCTIONS_RPC_URL ?? 'https://ethereum-rpc.publicnode.com'),
});

/**
 * Local list on top of the oracle: SECO's Swiss sanctions list has no
 * on-chain feed, so a compliance team maintains its own entries here (and the
 * demo uses it to show a hit on a testnet address).
 */
const LOCAL_DENYLIST = new Set(
  (process.env.SANCTIONED_ADDRESSES ?? '')
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean),
);

const cache = new Map<string, { hit: boolean; at: number }>();
const CACHE_MS = 10 * 60_000;

export type ScreeningResult = { hit: boolean; source: 'local-list' | 'chainalysis-oracle' | 'clear' };

/** Fail-closed: if the oracle can't be reached, throws rather than letting a transfer through. */
export async function screenAddress(address: string): Promise<ScreeningResult> {
  const key = address.toLowerCase();
  if (LOCAL_DENYLIST.has(key)) return { hit: true, source: 'local-list' };
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return { hit: cached.hit, source: cached.hit ? 'chainalysis-oracle' : 'clear' };
  let hit: boolean;
  try {
    hit = await oracleClient.readContract({
      address: SANCTIONS_ORACLE,
      abi: oracleAbi,
      functionName: 'isSanctioned',
      args: [getAddress(address)],
    });
  } catch (e) {
    throw new ScreeningUnavailableError(`Sanctions screening unavailable: ${(e as Error).message.split('\n')[0]}`);
  }
  cache.set(key, { hit, at: Date.now() });
  return { hit, source: hit ? 'chainalysis-oracle' : 'clear' };
}
