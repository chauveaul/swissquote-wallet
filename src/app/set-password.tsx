import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { StepHeader } from '@/components/Header';
import { PasswordField } from '@/components/PasswordField';
import { Screen, Spacer } from '@/components/Screen';
import { Overline, Text } from '@/components/Text';
import { biometricLabel, getBiometricKind, type BiometricKind } from '@/features/wallet/biometrics';
import { useWallet } from '@/features/wallet/store';
import { colors } from '@/theme/tokens';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Final onboarding step (create: 3 of 3, restore: 2 of 2). Not drawn in the
 * design, but implied by "Step 2 of 3" and "Next: set a new password for this
 * device"; built from the same components as the surrounding steps.
 */
export default function SetPassword() {
  const { flow } = useLocalSearchParams<{ flow: 'create' | 'restore' }>();
  const restoring = flow === 'restore';

  const draft = useWallet((s) => s.draftMnemonic);
  const createWallet = useWallet((s) => s.createWallet);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [bioKind, setBioKind] = useState<BiometricKind>(null);
  const [useBiometrics, setUseBiometrics] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const confirmRef = useRef<TextInput>(null);

  useEffect(() => {
    getBiometricKind().then(setBioKind).catch(() => setBioKind(null));
  }, []);

  if (!draft) return <Redirect href={restoring ? '/restore' : '/welcome'} />;

  const tooShort = password.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm !== password;

  const submit = async () => {
    setSubmitted(true);
    if (tooShort || mismatch) return;
    setBusy(true);
    setFailure(null);
    try {
      await createWallet(password, !!bioKind && useBiometrics);
      // The root layout's route guards take over once the wallet is unlocked.
    } catch {
      setFailure('Could not secure your wallet on this device. Please try again.');
      setBusy(false);
    }
  };

  return (
    <Screen paddingTop={16} gap={24}>
      <StepHeader step={restoring ? 2 : 3} total={restoring ? 2 : 3} />

      <View style={styles.intro}>
        <Overline>{restoring ? 'Restore wallet · Step 2 of 2' : 'Step 3 of 3'}</Overline>
        <Text accessibilityRole="header" size={28} lineHeight={1.15} weight={700} tracking={-0.01}>
          Set a password for this device
        </Text>
        <Text size={15} lineHeight={1.5} color={colors.textSecondary}>
          You’ll use it to unlock the wallet on this phone. It can’t be used to recover your wallet — only your
          recovery phrase can.
        </Text>
      </View>

      <View style={styles.fields}>
        <PasswordField
          label="New password"
          value={password}
          onChangeText={setPassword}
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          error={submitted && tooShort ? `Use at least ${MIN_PASSWORD_LENGTH} characters.` : null}
        />
        <PasswordField
          ref={confirmRef}
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          returnKeyType="done"
          onSubmitEditing={submit}
          error={submitted && !tooShort && mismatch ? 'Passwords don’t match.' : null}
        />
        {bioKind ? (
          <Checkbox
            checked={useBiometrics}
            onChange={setUseBiometrics}
            accessibilityLabel={`Unlock with ${biometricLabel(bioKind)}`}
          >
            <Text size={14} lineHeight={1.4} color={colors.textSecondary}>
              Unlock with {biometricLabel(bioKind)}
            </Text>
          </Checkbox>
        ) : null}
      </View>

      <Spacer />

      <View style={styles.footer}>
        {failure ? (
          <Text accessibilityRole="alert" size={13} weight={600} color={colors.accentText} align="center">
            {failure}
          </Text>
        ) : null}
        <Button label={restoring ? 'Restore wallet' : 'Create wallet'} onPress={submit} loading={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 10 },
  fields: { gap: 20 },
  footer: { gap: 8 },
});
