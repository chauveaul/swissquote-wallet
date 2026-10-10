import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { NavHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { PasswordField } from '@/components/PasswordField';
import { Screen, Spacer } from '@/components/Screen';
import { Text } from '@/components/Text';
import { openBackup, type BackupFile } from '@/features/wallet/backup';
import { WrongPasswordError } from '@/features/wallet/vault';
import { colors, radii } from '@/theme/tokens';

type Props = {
  fileName: string;
  backup: BackupFile;
  onCancel: () => void;
  /** Receives the decrypted phrase; it is never displayed. */
  onUnlocked: (phrase: string) => void;
};

/** Unlocks an encrypted backup file. Not drawn in the design; built from its components. */
export function BackupImportScreen({ fileName, backup, onCancel, onUnlocked }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const created = new Date(backup.createdAt);
  const createdLabel = Number.isNaN(created.getTime()) ? null : created.toLocaleDateString();

  const unlock = async () => {
    if (!password) {
      setError('Enter the backup password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const phrase = await openBackup(backup, password);
      setPassword('');
      onUnlocked(phrase);
    } catch (e) {
      setError(e instanceof WrongPasswordError ? 'Incorrect backup password. Try again.' : (e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Screen gap={24}>
      <NavHeader title="Import backup file" onBack={onCancel} />

      <View style={styles.intro}>
        <Text accessibilityRole="header" size={28} lineHeight={1.15} weight={700} tracking={-0.01}>
          Unlock your backup file
        </Text>
        <Text size={15} lineHeight={1.5} color={colors.textSecondary}>
          Enter the password you chose when you downloaded this backup. Your phrase is decrypted on this device only.
        </Text>
      </View>

      <View style={styles.fileCard}>
        <Icon name="file" size={22} />
        <View style={styles.flex}>
          <Text size={15} weight={600} numberOfLines={1}>
            {fileName}
          </Text>
          {createdLabel ? (
            <Text size={13} color={colors.textMuted}>
              Created {createdLabel}
            </Text>
          ) : null}
        </View>
      </View>

      <PasswordField
        label="Backup password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setError(null);
        }}
        returnKeyType="done"
        onSubmitEditing={unlock}
        error={error}
      />

      <Spacer />

      <View style={styles.footer}>
        <Button label="Unlock backup" onPress={unlock} loading={busy} />
        <Text size={12} color={colors.textMuted} align="center">
          Next: set a new password for this device
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  intro: { gap: 10 },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  footer: { gap: 8 },
});
