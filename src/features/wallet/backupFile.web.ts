import * as DocumentPicker from 'expo-document-picker';

export type SaveResult = 'saved' | 'cancelled';

/** Browsers can't share local files (Web Share needs HTTPS and a hosted URL). */
export const CAN_SHARE_BACKUP = false;

/** Web preview: downloads the encrypted backup through the browser. */
export async function saveBackupFile(name: string, contents: string): Promise<SaveResult> {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return 'saved';
}

export async function shareBackupFile(_name: string, _contents: string): Promise<void> {
  throw new Error('Sharing isn’t available in the browser.');
}

export async function pickBackupFile(): Promise<{ name: string; contents: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'] });
  if (result.canceled) return null;
  const asset = result.assets[0]!;
  return { name: asset.name, contents: asset.file ? await asset.file.text() : '' };
}
