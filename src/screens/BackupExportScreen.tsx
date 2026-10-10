import { useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Callout } from '@/components/Callout';
import { NavHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { PasswordField } from '@/components/PasswordField';
import { Screen, Spacer } from '@/components/Screen';
import { Text } from '@/components/Text';
import { backupFileName, createBackup, MIN_BACKUP_PASSWORD_LENGTH } from '@/features/wallet/backup';
import { CAN_SHARE_BACKUP, saveBackupFile, shareBackupFile } from '@/features/wallet/backupFile';
import { colors } from '@/theme/tokens';

type Props = {
  /** Returns the phrase to back up (may prompt for biometrics / passcode). */
  getPhrase: () => Promise<string | null>;
  onCancel: () => void;
  onSaved: () => void;
};

/**
 * Encrypted backup export. Not drawn in the design; built from its components.
 * Rendered inline by the recovery-phrase screen, so the phrase never travels
 * through route params.
 */
export function BackupExportScreen({ getPhrase, onCancel, onSaved }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const [outcome, setOutcome] = useState<'saved' | 'shared' | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const confirmRef = useRef<TextInput>(null);

  const tooShort = password.length < MIN_BACKUP_PASSWORD_LENGTH;
  const mismatch = confirm !== password;

  const exportBackup = async (via: 'save' | 'share') => {
    setSubmitted(true);
    setFailure(null);
    if (tooShort || mismatch) return;
    setBusy(via);
    try {
      const phrase = await getPhrase();
      if (!phrase) return;
      const contents = await createBackup(phrase, password);
      if (via === 'save') {
        // Cancelling the folder picker just returns to the form.
        if ((await saveBackupFile(backupFileName(), contents)) === 'cancelled') return;
      } else {
        await shareBackupFile(backupFileName(), contents);
      }
      setPassword('');
      setConfirm('');
      setOutcome(via === 'save' ? 'saved' : 'shared');
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'The backup file could not be saved.');
    } finally {
      setBusy(null);
    }
  };

  if (outcome) {
    return (
      <Screen paddingTop={16} gap={24}>
        <NavHeader title="Backup file" onBack={onSaved} />
        <View style={styles.intro}>
          <Icon name="check" size={32} color={colors.positive} strokeWidth={2.4} />
          <Text accessibilityRole="header" size={28} lineHeight={1.15} weight={700} tracking={-0.01}>
            {outcome === 'saved' ? 'Backup file saved' : 'Backup file ready'}
          </Text>
          <Text size={15} lineHeight={1.5} color={colors.textSecondary}>
            {outcome === 'saved'
              ? Platform.OS === 'web'
                ? 'It’s in your downloads.'
                : 'It’s in the folder you chose.'
              : 'If you saved it from the share sheet, it’s wherever you sent it.'}{' '}
            Keep the file somewhere safe and your backup password somewhere else. To restore, choose “Import an existing
            wallet”, then “Import backup file”.
          </Text>
        </View>
        <Spacer />
        <Button label="Done" onPress={onSaved} />
      </Screen>
    );
  }

  return (
    <Screen paddingTop={16} gap={24}>
      <NavHeader title="Backup file" onBack={onCancel} />

      <View style={styles.intro}>
        <Text accessibilityRole="header" size={28} lineHeight={1.15} weight={700} tracking={-0.01}>
          Download an encrypted backup
        </Text>
        <Text size={15} lineHeight={1.5} color={colors.textSecondary}>
          Save your recovery phrase as a file locked with a backup password. You can import the file to restore your
          wallet instead of typing the words.
        </Text>
      </View>

      <Callout>
        Keep the file and its password apart. Anyone with both can take your funds, and Swissquote can’t recover a
        forgotten backup password.
      </Callout>

      <View style={styles.fields}>
        <PasswordField
          label="Backup password"
          value={password}
          onChangeText={setPassword}
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          error={submitted && tooShort ? `Use at least ${MIN_BACKUP_PASSWORD_LENGTH} characters.` : null}
        />
        <PasswordField
          ref={confirmRef}
          label="Confirm backup password"
          value={confirm}
          onChangeText={setConfirm}
          returnKeyType="done"
          onSubmitEditing={() => exportBackup('save')}
          error={submitted && !tooShort && mismatch ? 'Passwords don’t match.' : null}
        />
        <Text size={13} color={colors.textMuted}>
          At least {MIN_BACKUP_PASSWORD_LENGTH} characters. Use a different password from the one that unlocks the app.
        </Text>
      </View>

      <Spacer />

      <View style={styles.footer}>
        {failure ? (
          <Text accessibilityRole="alert" size={13} weight={600} color={colors.accentText} align="center">
            {failure}
          </Text>
        ) : null}
        <Button
          label="Save to device"
          icon="download"
          onPress={() => exportBackup('save')}
          loading={busy === 'save'}
          disabled={busy === 'share'}
        />
        {CAN_SHARE_BACKUP ? (
          <Button
            label="Share file…"
            variant="secondary"
            icon="share"
            onPress={() => exportBackup('share')}
            loading={busy === 'share'}
            disabled={busy === 'save'}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 10 },
  fields: { gap: 20 },
  footer: { gap: 12 },
});
