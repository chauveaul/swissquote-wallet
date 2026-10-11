import { exceedsBalance, findContact, maxSendable, parseRecipient, sanitizeAmount } from '@/features/send/draft';
import { groupActivity } from '@/features/market/queries';
import { demoActivity, demoContacts, DEMO_NOW } from '@/features/market/fixtures';

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
    expect(findContact(demoContacts, parseRecipient('0x8ba1f109551bd432803012645ac136ddd64dba72'))?.name).toBe('Mia (Ledger)');
  });

  it('sanitizes amount input', () => {
    expect(sanitizeAmount('0,5')).toBe('0.5');
    expect(sanitizeAmount('1.2.3')).toBe('1.23');
    expect(sanitizeAmount('abc12')).toBe('12');
  });
});

describe('max amount', () => {
  it('never rounds up past the balance', () => {
    // toFixed(4) would give 0.0457, more than the balance.
    expect(maxSendable(0.04567, 0)).toBe('0.04567');
    expect(exceedsBalance(Number(maxSendable(0.04567, 0)), 0, 0.04567)).toBe(false);
  });

  it('leaves room for the fee', () => {
    const max = maxSendable(0.1, 0.000021);
    expect(max).toBe('0.099979');
    expect(exceedsBalance(Number(max), 0.000021, 0.1)).toBe(false);
    expect(exceedsBalance(0.09998, 0.000021, 0.1)).toBe(true);
  });

  it('is zero when the fee exceeds the balance', () => {
    expect(maxSendable(0.00001, 0.001)).toBe('0');
  });
});

describe('activity grouping', () => {
  it('groups the design fixtures into Today and 8 October 2026', () => {
    const groups = groupActivity(demoActivity, DEMO_NOW);
    expect(groups.map((g) => g.label)).toEqual(['Today', '8 October 2026']);
    expect(groups[1]!.items.map((i) => i.title)).toEqual(['Received ETH', 'Approve USDC spend', 'Sent LINK']);
  });
});
