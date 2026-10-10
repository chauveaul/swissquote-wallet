import { getAddress, isAddress, type Address } from 'viem';
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

/** Keeps a decimal string: digits and a single `.` (commas become dots). */
export function sanitizeAmount(input: string): string {
  const s = input.replace(',', '.').replace(/[^\d.]/g, '');
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
