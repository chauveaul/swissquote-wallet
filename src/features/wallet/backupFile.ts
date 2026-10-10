import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type SaveResult = 'saved' | 'cancelled';

/** Native builds can also hand the file to the share sheet (AirDrop, Drive…). */
export const CAN_SHARE_BACKUP = true;

const isCancellation = (e: unknown) => e instanceof Error && /cancel/i.test(e.message);

/**
 * Saves the (already encrypted) backup into a folder the user picks: the
 * Files app on iOS, the system storage picker on Android.
 */
export async function saveBackupFile(name: string, contents: string): Promise<SaveResult> {
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch (e) {
    if (isCancellation(e)) return 'cancelled';
    throw e;
  }
  const file = createUnique(directory, name);
  file.write(contents);
  return 'saved';
}

/** Never overwrite an earlier backup: `name.json`, `name (2).json`, … */
function createUnique(directory: Directory, name: string): File {
  const dot = name.lastIndexOf('.');
  const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  let lastError: unknown;
  for (let i = 1; i <= 20; i++) {
    try {
      return directory.createFile(i === 1 ? name : `${base} (${i})${ext}`, 'application/json');
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('The backup file could not be created.');
}

/**
 * Hands the backup to the system share sheet. The temporary copy is deleted
 * afterwards so nothing lingers in the app's cache.
 */
export async function shareBackupFile(name: string, contents: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing isn’t available on this device.');
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(contents);
  try {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      UTI: 'public.json',
      dialogTitle: 'Share wallet backup',
    });
  } finally {
    if (file.exists) file.delete();
  }
}

/** Lets the user pick a backup file and returns its text, or null if cancelled. */
export async function pickBackupFile(): Promise<{ name: string; contents: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', 'application/octet-stream'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0]!;
  const file = new File(asset.uri);
  try {
    return { name: asset.name, contents: await file.text() };
  } finally {
    if (file.exists) file.delete();
  }
}
