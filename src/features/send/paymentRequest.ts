import { formatEther, type Address } from 'viem';

import { networks } from '@/lib/networks';

import { parseRecipient } from './draft';

export type PaymentRequest = {
  address: Address;
  /** Requested amount in ETH (decimal string), if the code specified one. */
  amount?: string;
};

export class PaymentRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentRequestError';
  }
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Exact integer from a decimal or scientific string (`1000`, `2.014e18`); null if not an integer. */
function toBigInt(value: string): bigint | null {
  const m = /^(\d+)(?:\.(\d+))?(?:[eE]\+?(\d+))?$/.exec(value);
  if (!m) return null;
  const [, int = '', frac = '', exp = '0'] = m;
  const shift = Number(exp) - frac.length;
  if (shift < 0) {
    // Only valid if the dropped digits are zeros (e.g. "1.50e1" = 15).
    const digits = int + frac;
    const kept = digits.slice(0, digits.length + shift);
    return /^0*$/.test(digits.slice(digits.length + shift)) ? BigInt(kept || '0') : null;
  }
  return BigInt(int + frac + '0'.repeat(shift));
}

function checkedAddress(raw: string): Address {
  const address = parseRecipient(raw);
  if (!address) {
    throw new PaymentRequestError('This address has an invalid checksum. It may have been mistyped or tampered with.');
  }
  return address;
}

/**
 * Parses a scanned QR code: a bare address or an EIP-681 `ethereum:` payment
 * link for a native-asset transfer. Anything else is rejected rather than guessed.
 */
export function parsePaymentRequest(
  raw: string,
  currentChainId: number,
  options: { anyNetwork?: boolean } = {},
): PaymentRequest {
  const text = raw.trim();

  if (ADDRESS_RE.test(text)) return { address: checkedAddress(text) };

  const uri = /^ethereum:(?:pay-)?([^@/?]+)(?:@(\d+))?(?:\/([^?]+))?(?:\?(.*))?$/i.exec(text);
  if (!uri) throw new PaymentRequestError('This QR code doesn’t contain an Ethereum address.');

  const [, target = '', chain, fn, query = ''] = uri;
  if (!ADDRESS_RE.test(target)) {
    throw new PaymentRequestError('Name-based addresses (ENS) aren’t supported yet. Ask for the 0x address instead.');
  }
  if (fn) throw new PaymentRequestError('Token payment requests aren’t supported yet.');

  const chainId = chain ? Number(chain) : 1;
  // Saving a contact only needs the address, which is the same on every EVM network.
  if (!options.anyNetwork && chainId !== currentChainId) {
    const network = networks.find((n) => n.chain.id === chainId);
    throw new PaymentRequestError(
      network
        ? `This request is for ${network.name}. Switch to it in Accounts & networks, then scan again.`
        : `This request is for a network this wallet doesn’t support (chain ${chainId}).`,
    );
  }

  const value = new URLSearchParams(query).get('value');
  let amount: string | undefined;
  if (value !== null) {
    const wei = toBigInt(value);
    if (wei === null) throw new PaymentRequestError('This payment request has an invalid amount.');
    if (wei > 0n) amount = formatEther(wei);
  }

  return { address: checkedAddress(target), amount };
}
