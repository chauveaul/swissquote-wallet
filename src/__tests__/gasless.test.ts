import { delegationState, SIMPLE_7702_IMPLEMENTATION } from '@/services/gasless';

const designator = (address: string) => `0xef0100${address.slice(2)}`;

describe('EIP-7702 delegation detection', () => {
  it('treats an address without code as a plain EOA', () => {
    expect(delegationState(undefined)).toBe('none');
    expect(delegationState('0x')).toBe('none');
  });

  it('recognises a delegation to our implementation, case-insensitively', () => {
    expect(delegationState(designator(SIMPLE_7702_IMPLEMENTATION))).toBe('ours');
    expect(delegationState(designator(SIMPLE_7702_IMPLEMENTATION.toLowerCase()))).toBe('ours');
  });

  it('flags a delegation to another implementation, so it is never silently replaced', () => {
    expect(delegationState(designator('0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B'))).toBe('other');
  });

  it('flags real contract bytecode', () => {
    expect(delegationState('0x6080604052348015600f57600080fd5b50')).toBe('contract');
  });
});
