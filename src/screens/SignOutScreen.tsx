import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { Callout } from '@/components/Callout';
import { Checkbox } from '@/components/Checkbox';
import { NavHeader } from '@/components/Header';
import { PasswordField } from '@/components/PasswordField';
import { Screen, Spacer } from '@/components/Screen';
import { Text } from '@/components/Text';
import { signOut } from '@/features/wallet/signOut';
import { useWallet } from '@/features/wallet/store';
import { WrongPasswordError } from '@/features/wallet/vault';
import { colors } from '@/theme/tokens';

type Props = { onCancel: () => void };

/**
 * Sign out: removes this wallet from the device so another one can be created
 * or imported. Not drawn in the design; built from its components.
 *
 * Rendered as a wallet route when unlocked and inline on Unlock when locked,
 * never as a route shared by both states: the router would otherwise restore
 * it after the next wallet is set up.
 */
export function SignOutScreen({ onCancel }: Props) {
  const unlocked = useWallet((s) => s.status === 'unlocked');
  const verifyPassword = useWallet((s) => s.verifyPassword);

  const [saved, setSaved] = useState(false);
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setSubmitted(true);
    setPasswordError(null);
    if (!saved) return;
    if (!password) {
      setPasswordError('Enter your password to confirm.');
      return;
    }
    setBusy(true);
    try {
      await verifyPassword(password);
      await signOut();
      // Route guards now send the user to Welcome.
    } catch (e) {
      setPasswordError(e instanceof WrongPasswordError ? 'Incorrect password. Try again.' : 'Could not sign out.');
      setBusy(false);
    }
  };

  return (
    <Screen gap={24}>
      <NavHeader title="Sign out" onBack={onCancel} />

      <View style={styles.intro}>
        <Text accessibilityRole="header" size={28} lineHeight={1.15} weight={700} tracking={-0.01}>
          Remove this wallet from your device
        </Text>
        <Text size={15} lineHeight={1.5} color={colors.textSecondary}>
          Signing out deletes this wallet’s keys from this phone so you can create or import a different one. Your
          funds stay on the blockchain, but you can only get back in with your secret recovery phrase.
        </Text>
      </View>

      <Callout>Swissquote can never restore your wallet. Without your recovery phrase, your funds are lost for good.</Callout>

      {unlocked ? (
        <Pressable accessibilityRole="link" onPress={() => router.push('/recovery-phrase')} style={styles.link}>
          <Text size={15} weight={600} color={colors.accentText}>
            View my recovery phrase first
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.fields}>
        <Checkbox
          checked={saved}
          onChange={setSaved}
          invalid={submitted && !saved}
          accessibilityLabel="I’ve written down my secret recovery phrase and stored it safely"
        >
          <Text size={14} lineHeight={1.4} color={colors.textSecondary}>
            I’ve written down my secret recovery phrase and stored it safely.
          </Text>
        </Checkbox>
        {submitted && !saved ? (
          <Text accessibilityRole="alert" size={13} weight={600} color={colors.accentText}>
            Confirm you have your recovery phrase before signing out.
          </Text>
        ) : null}

        <PasswordField
          label="Password"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setPasswordError(null);
          }}
          onSubmitEditing={submit}
          returnKeyType="done"
          error={passwordError}
        />
      </View>

      <Spacer />

      <View style={styles.actions}>
        <Button label="Sign out and remove wallet" onPress={submit} loading={busy} />
        <Button label="Cancel" variant="secondary" onPress={onCancel} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 10 },
  link: { height: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  fields: { gap: 20 },
  actions: { gap: 12 },
});
