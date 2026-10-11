import { deriveAddress } from '@/features/wallet/keyring';
import { generateMnemonic, isValidMnemonic, isWordInList, normalizeWords } from '@/features/wallet/mnemonic';

describe('mnemonic', () => {
  it('generates valid 12 and 24 word phrases', () => {
    const twelve = generateMnemonic(12);
    const twentyFour = generateMnemonic(24);
    expect(twelve.split(' ')).toHaveLength(12);
    expect(twentyFour.split(' ')).toHaveLength(24);
    expect(isValidMnemonic(twelve)).toBe(true);
    expect(isValidMnemonic(twentyFour)).toBe(true);
    expect(generateMnemonic()).not.toBe(twelve);
  });

  it('rejects a bad checksum and wrong lengths', () => {
    expect(isValidMnemonic('test test test test test test test test test test test test')).toBe(false);
    expect(isValidMnemonic('test test test')).toBe(false);
  });

  it('accepts a valid phrase with stray whitespace', () => {
    const phrase = generateMnemonic(12);
    const messy = `  ${phrase.split(' ').join('  ').replace(' ', '\n')}\t`;
    expect(isValidMnemonic(messy)).toBe(true);
  });

  it('normalizes user input', () => {
    expect(normalizeWords([' Test', 'JUNK ', ''])).toBe('test junk');
    expect(isWordInList('Abandon')).toBe(true);
    expect(isWordInList('notaword')).toBe(false);
  });

  it('derives the standard BIP-44 Ethereum address', () => {
    // Well-known Hardhat/Foundry test mnemonic, m/44'/60'/0'/0/0 and /1.
    const phrase = 'test test test test test test test test test test test junk';
    expect(deriveAddress(phrase, 0)).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    expect(deriveAddress(phrase, 1)).toBe('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
  });
});
