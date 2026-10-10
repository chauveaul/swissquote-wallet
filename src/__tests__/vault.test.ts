import { createVault, decryptWithKey, parseVault, unlockVault, WrongPasswordError } from '@/features/wallet/vault';

// Low scrypt cost keeps the suite fast; production uses DEFAULT_KDF.
const FAST = { N: 2 ** 10, r: 8, p: 1 };
const PHRASE = 'test test test test test test test test test test test junk';

describe('vault', () => {
  it('round-trips the secret with the correct password', async () => {
    const { vault, key } = await createVault(PHRASE, 'correct horse', FAST);
    expect(vault.ciphertext).not.toContain('test');
    expect(decryptWithKey(vault, key)).toBe(PHRASE);
    await expect(unlockVault(vault, 'correct horse')).resolves.toMatchObject({ secret: PHRASE });
  });

  it('fails closed on a wrong password', async () => {
    const { vault } = await createVault(PHRASE, 'correct horse', FAST);
    await expect(unlockVault(vault, 'wrong horse')).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('detects tampering via the GCM auth tag', async () => {
    const { vault, key } = await createVault(PHRASE, 'pw', FAST);
    const flipped = (parseInt(vault.ciphertext[0]!, 16) ^ 1).toString(16);
    const tampered = { ...vault, ciphertext: flipped + vault.ciphertext.slice(1) };
    expect(() => decryptWithKey(tampered, key)).toThrow(WrongPasswordError);
  });

  it('uses a fresh salt and nonce per vault', async () => {
    const a = await createVault(PHRASE, 'pw', FAST);
    const b = await createVault(PHRASE, 'pw', FAST);
    expect(a.vault.kdf.salt).not.toBe(b.vault.kdf.salt);
    expect(a.vault.nonce).not.toBe(b.vault.nonce);
  });

  it('rejects unknown vault formats', () => {
    expect(() => parseVault(JSON.stringify({ version: 2 }))).toThrow('Unsupported vault format');
  });
});
