import { getAddress } from 'viem';

import { isSanctioned, SAMPLE_SANCTIONED_ADDRESS } from '@/features/dapp/sanctions';

describe('isSanctioned', () => {
  it('flags a known OFAC-listed address regardless of case', () => {
    expect(isSanctioned(SAMPLE_SANCTIONED_ADDRESS)).toBe(true);
    expect(isSanctioned(getAddress(SAMPLE_SANCTIONED_ADDRESS.toLowerCase()))).toBe(true);
  });

  it('does not flag an arbitrary address', () => {
    expect(isSanctioned(getAddress('0x1234567890123456789012345678901234567890'))).toBe(false);
  });
});
