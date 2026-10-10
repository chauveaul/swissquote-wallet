import { Linking, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';

import { NavHeader } from '@/components/Header';
import { LogoPlaceholder } from '@/components/Marks';
import { Screen } from '@/components/Screen';
import { SettingsGroup, SettingsRow } from '@/components/SettingsList';
import { Text } from '@/components/Text';
import { marketData } from '@/features/market/sources';
import { useNetworkId } from '@/features/wallet/store';
import { DEMO_MODE, LEGAL_URLS } from '@/lib/config';
import { getNetwork, rpcUrl } from '@/lib/networks';
import { colors } from '@/theme/tokens';

/** Settings → About. Not drawn in the design; built from the Settings list style. */
export default function About() {
  const networkId = useNetworkId();
  const network = getNetwork(networkId);
  const version = Constants.expoConfig?.version ?? '—';
  const rpcHost = (() => {
    try {
      return new URL(rpcUrl(networkId)).host;
    } catch {
      return '—';
    }
  })();

  return (
    <Screen background={colors.surfaceMuted} paddingHorizontal={16} gap={16}>
      <View style={styles.header}>
        <NavHeader title="About" />
      </View>

      <View style={styles.brand}>
        <LogoPlaceholder />
        <Text size={14} lineHeight={1.5} color={colors.textSecondary} align="center">
          A self-custody wallet by Swissquote. Your keys are created and stored only on this device.
        </Text>
      </View>

      <SettingsGroup label="App">
        <SettingsRow label="Version" value={version} />
        <SettingsRow label="Balances" value={DEMO_MODE ? 'Demo data' : 'Live'} />
        <SettingsRow label="Prices" value={marketData.name} />
        <SettingsRow label="Network" value={network.name} />
        <SettingsRow label="RPC endpoint" value={rpcHost} last />
      </SettingsGroup>

      <SettingsGroup label="Legal">
        <SettingsRow label="Terms of use" onPress={() => Linking.openURL(LEGAL_URLS.terms)} />
        <SettingsRow label="Privacy notice" onPress={() => Linking.openURL(LEGAL_URLS.privacy)} last />
      </SettingsGroup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 8 },
  brand: { alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 16 },
});
