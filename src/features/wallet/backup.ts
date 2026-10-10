import { isValidMnemonic } from './mnemonic';
import { createVault, parseVault, unlockVault, type VaultBlob } from './vault';

/**
 * Encrypted recovery-phrase backup file.
 *
 * The phrase is never written in plain text: it is encrypted exactly like the
 * on-device vault (scrypt → AES-256-GCM) under a separate backup password, so
 * a copy that leaks through cloud sync, e-mail or a lost USB stick is useless
 * without that password.
 */

export const BACKUP_FORMAT = 'swissquote-wallet-backup';
export const MIN_BACKUP_PASSWORD_LENGTH = 12;

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: 1;
  createdAt: string;
  vault: VaultBlob;
};

export class InvalidBackupError extends Error {
  constructor(message = 'This isn’t a Swissquote wallet backup file.') {
    super(message);
    this.name = 'InvalidBackupError';
  }
}

export async function createBackup(
  phrase: string,
  password: string,
  kdf?: { N: number; r: number; p: number },
): Promise<string> {
  if (!isValidMnemonic(phrase)) throw new Error('Invalid recovery phrase');
  if (password.length < MIN_BACKUP_PASSWORD_LENGTH) throw new Error('Backup password too short');
  const { vault, key } = await createVault(phrase, password, kdf);
  key.fill(0);
  const file: BackupFile = { format: BACKUP_FORMAT, version: 1, createdAt: new Date().toISOString(), vault };
  return JSON.stringify(file, null, 2);
}

/** Validates the file structure without needing the password. */
export function parseBackup(contents: string): BackupFile {
  let data: Partial<BackupFile>;
  try {
    data = JSON.parse(contents) as Partial<BackupFile>;
  } catch {
    throw new InvalidBackupError();
  }
  if (data?.format !== BACKUP_FORMAT || !data.vault) throw new InvalidBackupError();
  if (data.version !== 1) throw new InvalidBackupError('This backup was made by a newer version of the app.');
  try {
    return { ...(data as BackupFile), vault: parseVault(JSON.stringify(data.vault)) };
  } catch {
    throw new InvalidBackupError();
  }
}

/** Decrypts a backup. Throws `WrongPasswordError` for a wrong password. */
export async function openBackup(backup: BackupFile, password: string): Promise<string> {
  const { secret, key } = await unlockVault(backup.vault, password);
  key.fill(0);
  if (!isValidMnemonic(secret)) throw new InvalidBackupError('This backup file is damaged.');
  return secret;
}

/** `swissquote-wallet-backup-2026-10-10.json` */
export function backupFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${BACKUP_FORMAT}-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}
