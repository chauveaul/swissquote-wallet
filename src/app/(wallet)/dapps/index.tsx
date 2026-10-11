import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Callout } from '@/components/Callout';
import { NavHeader } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { SettingsGroup, SettingsRow } from '@/components/SettingsList';
import { APPROVED_DAPPS } from '@/features/dapp/allowlist';
import { colors } from '@/theme/tokens';

/**
 * Swissquote's approved-dApp directory — the only places the in-app browser
 * will open. Every request from any of them still goes through the same
 * sanctions screening, simulation and large-transaction checks as a direct
 * send; see `browser.tsx`.
 */
export default function Dapps() {
  return (
    <Screen background={colors.surfaceMuted} paddingHorizontal={16} gap={16}>
      <View style={styles.header}>
        <NavHeader title="dApps" onBack={() => router.back()} />
      </View>

      <Callout tone="info" background={colors.surface}>
        Only dApps Swissquote has reviewed are listed here. Every transaction they ask for is still screened against
        sanctions lists, simulated and shown in plain language before you sign anything.
      </Callout>

      <SettingsGroup label="Approved dApps">
        {APPROVED_DAPPS.map((dapp, i) => (
          <SettingsRow
            key={dapp.id}
            label={dapp.name}
            detail={dapp.description}
            onPress={() => router.push({ pathname: '/dapps/browser', params: { id: dapp.id } })}
            last={i === APPROVED_DAPPS.length - 1}
          />
        ))}
      </SettingsGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 8 },
});
