import {
  backupFileName,
  createBackup,
  InvalidBackupError,
  openBackup,
  parseBackup,
} from '@/features/wallet/backup';
import { WrongPasswordError } from '@/features/wallet/vault';

const PHRASE = 'test test test test test test test test test test test junk';
const PASSWORD = 'correct horse battery';
const FAST = { N: 2 ** 10, r: 8, p: 1 };

describe('backup file', () => {
  it('round-trips the phrase and never stores it in plain text', async () => {
    const contents = await createBackup(PHRASE, PASSWORD, FAST);
    expect(contents).not.toContain('test');
    expect(contents).not.toContain('junk');
    const backup = parseBackup(contents);
    expect(backup.format).toBe('swissquote-wallet-backup');
    await expect(openBackup(backup, PASSWORD)).resolves.toBe(PHRASE);
  });

  it('rejects a wrong password', async () => {
    const backup = parseBackup(await createBackup(PHRASE, PASSWORD, FAST));
    await expect(openBackup(backup, 'wrong password!')).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('rejects tampered ciphertext', async () => {
    const backup = parseBackup(await createBackup(PHRASE, PASSWORD, FAST));
    const c = backup.vault.ciphertext;
    backup.vault.ciphertext = (c[0] === '0' ? '1' : '0') + c.slice(1);
    await expect(openBackup(backup, PASSWORD)).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('refuses short backup passwords and invalid phrases', async () => {
    await expect(createBackup(PHRASE, 'short', FAST)).rejects.toThrow('too short');
    await expect(createBackup('not a phrase', PASSWORD, FAST)).rejects.toThrow('Invalid recovery phrase');
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('hello')).toThrow(InvalidBackupError);
    expect(() => parseBackup(JSON.stringify({ format: 'other' }))).toThrow(InvalidBackupError);
    expect(() => parseBackup(JSON.stringify({ format: 'swissquote-wallet-backup', version: 2, vault: {} }))).toThrow(
      'newer version',
    );
  });

  it('names files by date', () => {
    expect(backupFileName(new Date(2026, 9, 10))).toBe('swissquote-wallet-backup-2026-10-10.json');
  });
});
