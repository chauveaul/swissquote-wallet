import { gcm } from '@noble/ciphers/aes';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/ciphers/utils';
import { randomBytes } from '@noble/ciphers/webcrypto';
import { scryptAsync } from '@noble/hashes/scrypt';

/**
 * Encrypted vault holding the recovery phrase.
 *
 * - Key derivation: scrypt(password, 16-byte random salt) → 256-bit key.
 * - Encryption: AES-256-GCM with a random 96-bit nonce; GCM's auth tag makes a
 *   wrong password fail closed instead of yielding garbage.
 * - KDF parameters are stored with the blob so they can be raised later
 *   without breaking existing vaults.
 */

export type KdfParams = { name: 'scrypt'; N: number; r: number; p: number; salt: string };

export type VaultBlob = {
  version: 1;
  kdf: KdfParams;
  cipher: 'aes-256-gcm';
  nonce: string;
  ciphertext: string;
};

/** scrypt N=2^15, r=8 (32 MiB). Tuned to stay ~1s on mid-range phones under Hermes. */
export const DEFAULT_KDF = { N: 2 ** 15, r: 8, p: 1 } as const;

const AAD = utf8ToBytes('sq-wallet-vault-v1');

export class WrongPasswordError extends Error {
  constructor() {
    super('Incorrect password');
    this.name = 'WrongPasswordError';
  }
}

export async function deriveKey(password: string, kdf: KdfParams): Promise<Uint8Array> {
  return scryptAsync(password.normalize('NFKC'), hexToBytes(kdf.salt), {
    N: kdf.N,
    r: kdf.r,
    p: kdf.p,
    dkLen: 32,
  });
}

/** Creates a new vault and returns it together with the derived key (for session use). */
export async function createVault(
  secret: string,
  password: string,
  params: { N: number; r: number; p: number } = DEFAULT_KDF,
): Promise<{ vault: VaultBlob; key: Uint8Array }> {
  const kdf: KdfParams = { name: 'scrypt', ...params, salt: bytesToHex(randomBytes(16)) };
  const key = await deriveKey(password, kdf);
  return { vault: encryptWithKey(secret, key, kdf), key };
}

export function encryptWithKey(secret: string, key: Uint8Array, kdf: KdfParams): VaultBlob {
  const nonce = randomBytes(12);
  const ciphertext = gcm(key, nonce, AAD).encrypt(utf8ToBytes(secret));
  return {
    version: 1,
    kdf,
    cipher: 'aes-256-gcm',
    nonce: bytesToHex(nonce),
    ciphertext: bytesToHex(ciphertext),
  };
}

export function decryptWithKey(vault: VaultBlob, key: Uint8Array): string {
  try {
    const plain = gcm(key, hexToBytes(vault.nonce), AAD).decrypt(hexToBytes(vault.ciphertext));
    return new TextDecoder().decode(plain);
  } catch {
    throw new WrongPasswordError();
  }
}

/** Derives the key from `password` and verifies it by decrypting the vault. */
export async function unlockVault(
  vault: VaultBlob,
  password: string,
): Promise<{ secret: string; key: Uint8Array }> {
  const key = await deriveKey(password, vault.kdf);
  const secret = decryptWithKey(vault, key);
  return { secret, key };
}

export function parseVault(raw: string): VaultBlob {
  const v = JSON.parse(raw) as VaultBlob;
  if (v.version !== 1 || v.cipher !== 'aes-256-gcm' || v.kdf?.name !== 'scrypt') {
    throw new Error('Unsupported vault format');
  }
  return v;
}

export { bytesToHex, hexToBytes };
