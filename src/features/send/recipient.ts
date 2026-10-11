import { isAddressEqual, type Address } from 'viem';

import type { Contact } from '@/features/market/types';
import type { AccountMeta, SwissquoteLink } from '@/features/wallet/store';

export type KnownRecipient =
  | { kind: 'self'; name: string; index: number }
  | { kind: 'account'; name: string; index: number }
  | { kind: 'contact'; name: string }
  | { kind: 'swissquote'; name: string };

/**
 * Who an address belongs to, if we know: the sending account itself, another
 * account of this wallet, a saved contact, or the linked Swissquote custodial
 * address (accounts win over contacts win over Swissquote).
 */
export function identifyRecipient(
  address: Address | null,
  fromIndex: number,
  accounts: readonly AccountMeta[],
  contacts: readonly Contact[],
  swissquote?: SwissquoteLink | null,
): KnownRecipient | null {
  if (!address) return null;
  const account = accounts.find((a) => isAddressEqual(a.address, address));
  if (account) {
    return { kind: account.index === fromIndex ? 'self' : 'account', name: account.name, index: account.index };
  }
  const contact = contacts.find((c) => isAddressEqual(c.address, address));
  if (contact) return { kind: 'contact', name: contact.name };
  if (swissquote && isAddressEqual(swissquote.custodialAddress, address)) {
    return { kind: 'swissquote', name: swissquote.name };
  }
  return null;
}
