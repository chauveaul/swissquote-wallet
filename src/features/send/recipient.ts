import type { Address } from 'viem';

import type { Contact } from '@/features/market/types';
import type { AccountMeta } from '@/features/wallet/store';

export type KnownRecipient =
  | { kind: 'self'; name: string; index: number }
  | { kind: 'account'; name: string; index: number }
  | { kind: 'contact'; name: string };

const same = (a: Address, b: Address) => a.toLowerCase() === b.toLowerCase();

/**
 * Who an address belongs to, if we know: the sending account itself, another
 * account of this wallet, or a saved contact (accounts win over contacts).
 */
export function identifyRecipient(
  address: Address | null,
  fromIndex: number,
  accounts: readonly AccountMeta[],
  contacts: readonly Contact[],
): KnownRecipient | null {
  if (!address) return null;
  const account = accounts.find((a) => same(a.address, address));
  if (account) {
    return { kind: account.index === fromIndex ? 'self' : 'account', name: account.name, index: account.index };
  }
  const contact = contacts.find((c) => same(c.address, address));
  return contact ? { kind: 'contact', name: contact.name } : null;
}
