import { generateMnemonic as bip39Generate, validateMnemonic as bip39Validate } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

export type PhraseLength = 12 | 24;

/** BIP-39 entropy: 128 bits → 12 words, 256 bits → 24 words. */
const STRENGTH: Record<PhraseLength, number> = { 12: 128, 24: 256 };

/**
 * Generates a new BIP-39 mnemonic using the platform CSPRNG
 * (`crypto.getRandomValues`, polyfilled natively in `index.ts`).
 */
export function generateMnemonic(length: PhraseLength = 12): string {
  return bip39Generate(wordlist, STRENGTH[length]);
}

/** Lower-cases and collapses whitespace so user input matches the wordlist. */
export function normalizeWords(words: readonly string[]): string {
  return words
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
}

/** Validates word count, wordlist membership and the BIP-39 checksum. */
export function isValidMnemonic(phrase: string): boolean {
  const count = phrase.split(' ').length;
  if (count !== 12 && count !== 24) return false;
  return bip39Validate(phrase, wordlist);
}

export function isWordInList(word: string): boolean {
  return wordlist.includes(word.trim().toLowerCase());
}
