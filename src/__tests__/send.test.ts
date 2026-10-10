import { findContact, parseRecipient, sanitizeAmount } from '@/features/send/draft';
import { groupActivity } from '@/features/market/queries';
import { demoActivity, DEMO_NOW } from '@/features/market/fixtures';

describe('send draft', () => {
  it('accepts checksummed and lower-case addresses', () => {
    expect(parseRecipient('0x8ba1f109551bD432803012645Ac136ddd64DBA72')).toBe(
      '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
    );
    expect(parseRecipient('0x8ba1f109551bd432803012645ac136ddd64dba72')).toBe(
      '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
    );
  });

  it('rejects malformed addresses and bad checksums', () => {
    expect(parseRecipient('0x123')).toBeNull();
    // As drawn in the design: mixed case with an invalid EIP-55 checksum.
    expect(parseRecipient('0x8Ba1f109551bD432803012645Ac136ddd64DBA72')).toBeNull();
  });

  it('matches saved contacts case-insensitively', () => {
    expect(findContact(parseRecipient('0x8ba1f109551bd432803012645ac136ddd64dba72'))?.name).toBe('Mia (Ledger)');
  });

  it('sanitizes amount input', () => {
    expect(sanitizeAmount('0,5')).toBe('0.5');
    expect(sanitizeAmount('1.2.3')).toBe('1.23');
    expect(sanitizeAmount('abc12')).toBe('12');
  });
});

describe('activity grouping', () => {
  it('groups the design fixtures into Today and 8 October 2026', () => {
    const groups = groupActivity(demoActivity, DEMO_NOW);
    expect(groups.map((g) => g.label)).toEqual(['Today', '8 October 2026']);
    expect(groups[1]!.items.map((i) => i.title)).toEqual(['Received ETH', 'Approve USDC spend', 'Sent LINK']);
  });
});
