import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { NavHeader } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { SettingsGroup, SettingsRow } from '@/components/SettingsList';
import { Text } from '@/components/Text';
import { confirmUserPresence, isBiometricsAvailable } from '@/features/wallet/biometrics';
import { AUTO_LOCK_OPTIONS_MS, useWallet } from '@/features/wallet/store';
import { formatAutoLock } from '@/lib/autoLock';
import { colors } from '@/theme/tokens';

/** Settings → Biometrics & auto-lock. Not drawn in the design; built from the Settings list style. */
export default function Security() {
  const biometrics = useWallet((s) => s.meta?.biometrics ?? false);
  const autoLockMs = useWallet((s) => s.meta?.autoLockMs ?? 60_000);
  const setBiometrics = useWallet((s) => s.setBiometrics);
  const setAutoLock = useWallet((s) => s.setAutoLock);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isBiometricsAvailable()
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }, []);

  const toggle = async (on: boolean) => {
    setError(null);
    setBusy(true);
    try {
      // Turning it on stores the unlock key behind biometrics: confirm it's really the owner.
      if (on && !(await confirmUserPresence('Turn on biometric unlock'))) return;
      await setBiometrics(on);
    } catch {
      setError(on ? 'Biometric unlock couldn’t be turned on. Make sure a device passcode is set.' : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen background={colors.surfaceMuted} paddingHorizontal={16} gap={16}>
      <View style={styles.header}>
        <NavHeader title="Biometrics & auto-lock" />
      </View>

      <SettingsGroup
        label="Biometrics"
        footer={
          available === false
            ? 'Set up face or fingerprint recognition in your device settings to use biometric unlock.'
            : 'Unlock the wallet and approve transactions with your face or fingerprint. Your password always works too.'
        }
      >
        <SettingsRow
          label="Unlock with biometrics"
          last
          right={
            <Switch
              accessibilityLabel="Unlock with biometrics"
              value={biometrics}
              disabled={busy || available === false}
              onValueChange={toggle}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          }
        />
      </SettingsGroup>
      {error ? (
        <Text accessibilityRole="alert" size={13} weight={600} color={colors.accentText} style={styles.error}>
          {error}
        </Text>
      ) : null}

      <View accessibilityRole="radiogroup" accessibilityLabel="Auto-lock">
        <SettingsGroup label="Auto-lock" footer="The wallet locks when the app has been in the background this long.">
          {AUTO_LOCK_OPTIONS_MS.map((ms, i) => (
            <SettingsRow
              key={ms}
              role="radio"
              label={formatAutoLock(ms)}
              selected={ms === autoLockMs}
              onPress={() => setAutoLock(ms)}
              last={i === AUTO_LOCK_OPTIONS_MS.length - 1}
            />
          ))}
        </SettingsGroup>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 8 },
  error: { paddingHorizontal: 8 },
});
