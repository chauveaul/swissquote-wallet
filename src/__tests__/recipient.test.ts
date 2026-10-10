import { identifyRecipient } from '@/features/send/recipient';

const A0 = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const A1 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const MIA = '0x8ba1f109551bD432803012645Ac136ddd64DBA72';

const SQ = '0x5Cad27dF4A123352Cbb32DF82549da23DbF9D77B';

const accounts = [
  { index: 0, name: 'Account 1', address: A0 },
  { index: 1, name: 'Savings', address: A1 },
] as const;
const contacts = [{ name: 'Mia (Ledger)', address: MIA }] as const;
const swissquote = { customerId: 'SQ-1001', name: 'Alex Müller', accountNumber: '1001', custodialAddress: SQ, linkedAt: '' } as const;

describe('identifyRecipient', () => {
  it('recognises own accounts, the sending account and contacts', () => {
    expect(identifyRecipient(A1, 0, accounts, contacts)).toEqual({ kind: 'account', name: 'Savings', index: 1 });
    expect(identifyRecipient(A0, 0, accounts, contacts)).toEqual({ kind: 'self', name: 'Account 1', index: 0 });
    expect(identifyRecipient(MIA, 0, accounts, contacts)).toEqual({ kind: 'contact', name: 'Mia (Ledger)' });
  });

  it('prefers the account when a contact has the same address, and ignores case', () => {
    const dup = [{ name: 'Old label', address: A1 }] as const;
    expect(identifyRecipient(A1.toLowerCase() as `0x${string}`, 0, accounts, dup)?.kind).toBe('account');
  });

  it('returns null for unknown or missing addresses', () => {
    expect(identifyRecipient('0x0000000000000000000000000000000000000001', 0, accounts, contacts)).toBeNull();
    expect(identifyRecipient(null, 0, accounts, contacts)).toBeNull();
  });

  it('recognises the linked Swissquote custodial address', () => {
    expect(identifyRecipient(SQ, 0, accounts, contacts, swissquote)).toEqual({ kind: 'swissquote', name: 'Alex Müller' });
  });

  it('ignores Swissquote when nothing is linked, and never outranks an account or contact', () => {
    expect(identifyRecipient(SQ, 0, accounts, contacts, null)).toBeNull();
    expect(identifyRecipient(SQ, 0, accounts, contacts)).toBeNull();
    const dup = [{ name: 'Someone', address: SQ }] as const;
    expect(identifyRecipient(SQ, 0, accounts, dup, swissquote)?.kind).toBe('contact');
  });
});
