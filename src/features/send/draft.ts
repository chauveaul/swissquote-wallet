import { formatUnits, getAddress, isAddress, type Address } from 'viem';
import { create } from 'zustand';

import { demoQuotes } from '@/features/market/fixtures';
import type { Contact, FeeSpeed } from '@/features/market/types';

/** Transfer being composed on Send and confirmed on Review. */
type SendDraft = {
  to: string;
  amount: string;
  speed: FeeSpeed;
  setTo: (to: string) => void;
  setAmount: (amount: string) => void;
  setSpeed: (speed: FeeSpeed) => void;
  reset: () => void;
};

const initial = { to: '', amount: '', speed: 'market' as FeeSpeed };

export const useSendDraft = create<SendDraft>((set) => ({
  ...initial,
  setTo: (to) => set({ to: to.trim() }),
  setAmount: (amount) => set({ amount: sanitizeAmount(amount) }),
  setSpeed: (speed) => set({ speed }),
  reset: () => set(initial),
}));

/**
 * Keeps a decimal string: digits and a single `.`. Separators are read the way
 * people write them: a lone comma is a decimal point ("0,5"); with both kinds
 * the last one is the decimal point and the others group thousands
 * ("1,234.56" and "1.234,56" are both 1234.56); several commas and no dot are
 * all grouping ("1,234,567").
 */
export function sanitizeAmount(input: string): string {
  const commas = (input.match(/,/g) ?? []).length;
  const hasDot = input.includes('.');
  let normalized = input;
  if (commas > 1 && !hasDot) {
    normalized = input.replace(/,/g, '');
  } else if (commas > 0 && hasDot) {
    const last = Math.max(input.lastIndexOf('.'), input.lastIndexOf(','));
    normalized = `${input.slice(0, last).replace(/[.,]/g, '')}.${input.slice(last + 1)}`;
  }
  const s = normalized.replace(',', '.').replace(/[^\d.]/g, '');
  const [int = '', ...rest] = s.split('.');
  return rest.length ? `${int}.${rest.join('')}` : int;
}

/**
 * Accepts lower-case or correctly checksummed addresses; rejects mixed-case
 * strings with a bad EIP-55 checksum, which usually indicates a typo.
 */
export function parseRecipient(input: string): Address | null {
  if (!isAddress(input, { strict: true })) return null;
  return getAddress(input);
}

export function findContact(contacts: readonly Contact[], address: Address | null): Contact | null {
  if (!address) return null;
  return contacts.find((c) => c.address.toLowerCase() === address.toLowerCase()) ?? null;
}

/** Network fee for a speed; `chf` is null when no ETH price is available. */
export function feeFor(speed: FeeSpeed, ethChf: number | null) {
  const eth = demoQuotes.feeEth[speed];
  return { eth, chf: ethChf === null ? null : eth * ethChf, eta: demoQuotes.feeEta[speed] };
}

// Balances are read at gwei precision (see `toEther`), so amounts are compared
// in whole gwei: float maths on ETH values can round past the balance.
const GWEI = 1e9;
const toGwei = (eth: number) => Math.round(eth * GWEI);

/** Largest sendable amount: balance minus fee, rounded down, never up past the balance. */
export function maxSendable(balance: number, fee: number): string {
  const gwei = toGwei(balance) - Math.ceil(fee * GWEI);
  return gwei > 0 ? formatUnits(BigInt(gwei), 9) : '0';
}

/** True when amount plus fee is more than the balance. */
export function exceedsBalance(amount: number, fee: number, balance: number): boolean {
  return toGwei(amount) + Math.ceil(fee * GWEI) > toGwei(balance);
}
