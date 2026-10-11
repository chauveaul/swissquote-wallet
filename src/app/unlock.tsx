import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { LogoPlaceholder } from '@/components/Marks';
import { PasswordField } from '@/components/PasswordField';
import { Screen, Spacer } from '@/components/Screen';
import { Text } from '@/components/Text';
import { isBiometricsAvailable } from '@/features/wallet/biometrics';
import { useWallet } from '@/features/wallet/store';
import { WrongPasswordError } from '@/features/wallet/vault';
import { closeKeyboard } from '@/lib/keyboard';
import { SignOutScreen } from '@/screens/SignOutScreen';
import { colors } from '@/theme/tokens';

/** 03 Unlock */
export default function Unlock() {
  const unlockWithPassword = useWallet((s) => s.unlockWithPassword);
  const unlockWithBiometrics = useWallet((s) => s.unlockWithBiometrics);
  const biometricsEnabled = useWallet((s) => s.meta?.biometrics ?? false);

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const tryBiometrics = useCallback(async () => {
    setError(null);
    try {
      const ok = await unlockWithBiometrics('Unlock your wallet');
      if (!ok) {
        setError(
          biometricsEnabled
            ? 'Biometrics didn’t unlock the wallet. Try again or use your password.'
            : 'Biometric unlock isn’t set up for this wallet. Use your password.',
        );
      }
    } catch {
      setError('Biometrics could not unlock the wallet. Use your password.');
    }
  }, [unlockWithBiometrics, biometricsEnabled]);

  useEffect(() => {
    isBiometricsAvailable().then(setHasBiometrics).catch(() => setHasBiometrics(false));
  }, []);

  // Offer biometrics straight away, like the system unlock. Failures are
  // silent here; the password field stays available.
  useEffect(() => {
    if (biometricsEnabled) unlockWithBiometrics('Unlock your wallet').catch(() => undefined);
  }, [biometricsEnabled, unlockWithBiometrics]);

  const submit = async () => {
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      // Unlocking swaps this screen for the wallet: close the keyboard first.
      await closeKeyboard();
      await unlockWithPassword(password);
      setPassword('');
    } catch (e) {
      setError(e instanceof WrongPasswordError ? 'Incorrect password. Try again.' : 'Could not unlock the wallet.');
    } finally {
      setBusy(false);
    }
  };

  if (signingOut) return <SignOutScreen onCancel={() => setSigningOut(false)} />;

  return (
    <Screen background={colors.dark.background} statusBar="light" paddingTop={72} gap={32}>
      <View pointerEvents="none" accessibilityElementsHidden style={styles.ring} />

      <LogoPlaceholder dark />

      <View style={styles.intro}>
        <Text accessibilityRole="header" size={34} lineHeight={1.1} weight={700} tracking={-0.02} color={colors.surface}>
          Welcome back
        </Text>
        <Text size={16} lineHeight={1.45} color={colors.dark.textSecondary}>
          Unlock your wallet to continue.
        </Text>
      </View>

      <PasswordField
        tone="dark"
        label="Password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setError(null);
        }}
        onSubmitEditing={submit}
        returnKeyType="go"
        error={error}
      />

      <Spacer />

      <View style={styles.actions}>
        <Button label="Unlock" variant="inverse" onPress={submit} loading={busy} disabled={!password} />
        {hasBiometrics ? (
          <Button
            label="Use biometrics"
            variant="outlineDark"
            icon="biometrics"
            gap={10}
            onPress={tryBiometrics}
          />
        ) : null}
        <Pressable accessibilityRole="link" onPress={() => router.push('/restore')} style={styles.forgot}>
          <Text size={14} color={colors.surface} style={styles.underline}>
            Forgot password? Restore with recovery phrase
          </Text>
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => setSigningOut(true)} style={styles.forgot}>
          <Text size={14} color={colors.surface} style={styles.underline}>
            Sign out and use a different wallet
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    left: -120,
    bottom: -160,
    width: 360,
    height: 360,
    borderRadius: 180,
    borderWidth: 56,
    borderColor: colors.accent,
    opacity: 0.9,
  },
  intro: { gap: 10 },
  actions: { gap: 12 },
  forgot: { alignSelf: 'center', height: 44, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
});
