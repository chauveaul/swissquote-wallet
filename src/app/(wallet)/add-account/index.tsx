import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { StepHeader } from '@/components/Header';
import { Screen, Spacer } from '@/components/Screen';
import { Overline, Text } from '@/components/Text';
import { useWallet } from '@/features/wallet/store';
import { colors } from '@/theme/tokens';

/** Add account · Step 1 of 2: a brand-new phrase, or an existing one. */
export default function AddAccount() {
  const beginCreate = useWallet((s) => s.beginCreate);
  const clearDraft = useWallet((s) => s.clearDraft);

  // Every new account gets a fresh phrase, never one left over from an earlier attempt.
  useEffect(() => clearDraft(), [clearDraft]);

  return (
    <Screen gap={24}>
      <StepHeader step={1} total={2} />

      <View style={styles.intro}>
        <Overline>Add account · Step 1 of 2</Overline>
        <Text accessibilityRole="header" size={28} lineHeight={1.15} weight={700} tracking={-0.01}>
          Add an account
        </Text>
        <Text size={15} lineHeight={1.5} color={colors.textSecondary}>
          Each account has its own secret recovery phrase. Create a new one, or import an account you already
          have. It stays protected by this device’s password.
        </Text>
      </View>

      <Spacer />

      <View style={styles.actions}>
        <Button
          label="Create a new account"
          onPress={() => {
            clearDraft();
            beginCreate();
            router.push('/add-account/create');
          }}
        />
        <Button
          label="Import with a recovery phrase"
          variant="secondary"
          onPress={() => router.push('/add-account/import')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 10 },
  actions: { gap: 12 },
});
