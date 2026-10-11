import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Button } from '@/components/Button';
import { NavHeader } from '@/components/Header';
import { Screen, Spacer } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { ACCOUNT_NAME_MAX, useWallet } from '@/features/wallet/store';
import { truncateAddress } from '@/lib/format';
import { colors } from '@/theme/tokens';

/** Rename an account. Not drawn in the design; built from the contact form. */
export default function AccountName() {
  const params = useLocalSearchParams<{ index: string }>();
  const index = Number(params.index);
  const account = useWallet((s) => s.meta?.accounts.find((a) => a.index === index));
  const renameAccount = useWallet((s) => s.renameAccount);

  const [name, setName] = useState(account?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Signed out of this account meanwhile: this screen is about to close.
  if (!account) return null;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await renameAccount(index, name);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The name couldn’t be saved.');
      setBusy(false);
    }
  };

  return (
    <Screen gap={24}>
      <NavHeader title="Account name" backIcon="close" />

      <View style={styles.fields}>
        <TextField
          label="Name"
          value={name}
          onChangeText={(v) => {
            setName(v);
            setError(null);
          }}
          placeholder={`Account ${index + 1}`}
          autoCapitalize="words"
          autoFocus
          maxLength={ACCOUNT_NAME_MAX}
          returnKeyType="done"
          onSubmitEditing={save}
          error={error}
        />
        <Text size={13} lineHeight={1.4} color={colors.textMuted}>
          Only shown on this device. The account’s address stays{' '}
          <Text mono size={13} color={colors.textMuted}>
            {truncateAddress(account.address)}
          </Text>
          .
        </Text>
      </View>

      <Spacer />

      <Button label="Save" onPress={save} loading={busy} disabled={!name.trim()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 12 },
});
