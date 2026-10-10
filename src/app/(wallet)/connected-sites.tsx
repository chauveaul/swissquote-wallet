import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Callout } from '@/components/Callout';
import { NavHeader } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { SettingsGroup, SettingsRow } from '@/components/SettingsList';
import { Text } from '@/components/Text';
import { useWallet } from '@/features/wallet/store';
import { getNetwork } from '@/lib/networks';
import { colors } from '@/theme/tokens';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatDate = (t: number) => {
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/**
 * Settings → Connected sites. Not drawn in the design. Sessions are demo data
 * until a dApp connection protocol (e.g. WalletConnect) is integrated.
 */
export default function ConnectedSites() {
  const sites = useWallet((s) => s.meta?.connectedSites ?? []);
  const disconnectSite = useWallet((s) => s.disconnectSite);
  const disconnectAll = useWallet((s) => s.disconnectAllSites);

  return (
    <Screen background={colors.surfaceMuted} paddingHorizontal={16} gap={16}>
      <View style={styles.header}>
        <NavHeader title="Connected sites" />
      </View>

      <Callout tone="info" size={13} background={colors.surface}>
        Connected sites can see your address and balances and ask you to approve transactions. You confirm every request
        in the app.
      </Callout>

      {sites.length === 0 ? (
        <Text size={15} color={colors.textSecondary} align="center" style={styles.empty}>
          No sites are connected to this wallet.
        </Text>
      ) : (
        <>
          <SettingsGroup label={`${sites.length} connected`}>
            {sites.map((site, i) => (
              <SettingsRow
                key={site.id}
                label={site.name}
                detail={`${site.host} · ${getNetwork(site.networkId).name} · since ${formatDate(site.connectedAt)}`}
                last={i === sites.length - 1}
                right={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Disconnect ${site.name}`}
                    onPress={() => disconnectSite(site.id)}
                    hitSlop={8}
                  >
                    <Text size={14} weight={600} color={colors.accentText}>
                      Disconnect
                    </Text>
                  </Pressable>
                }
              />
            ))}
          </SettingsGroup>
          <Button
            label="Disconnect all"
            variant="secondary"
            height={48}
            fontSize={15}
            onPress={disconnectAll}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 8 },
  empty: { paddingVertical: 24 },
});
