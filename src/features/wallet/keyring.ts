import type { Address, HDAccount } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';

/**
 * BIP-44 Ethereum derivation: m/44'/60'/0'/0/{index}. Every supported network
 * is EVM-compatible, so one address serves all of them.
 */
export function deriveAccount(mnemonic: string, index: number): HDAccount {
  return mnemonicToAccount(mnemonic, { addressIndex: index });
}

export function deriveAddress(mnemonic: string, index: number): Address {
  return deriveAccount(mnemonic, index).address;
}
