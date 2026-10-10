import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { NavHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { AccountAvatar, TokenMark } from '@/components/Marks';
import { Screen } from '@/components/Screen';
import { Overline, Text } from '@/components/Text';
import { usePortfolio } from '@/features/market/queries';
import { useFiat } from '@/features/settings/useFiat';
import { accountColor } from '@/features/wallet/accountColor';
import { useWallet, type AccountMeta } from '@/features/wallet/store';
import { truncateAddress } from '@/lib/format';
import { networks } from '@/lib/networks';
import { colors } from '@/theme/tokens';

function AccountRow({ account, selected, onPress }: { account: AccountMeta; selected: boolean; onPress: () => void }) {
  const fiat = useFiat();
  const { data } = usePortfolio(account.index);
  const color = accountColor(account.index);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${account.name}, ${account.address}`}
      onPress={onPress}
      style={[
        styles.row,
        styles.accountRow,
        selected
          ? { backgroundColor: colors.accentSurface, boxShadow: `inset 4px 0 0 ${colors.accent}` }
          : { backgroundColor: colors.surface },
      ]}
    >
      <AccountAvatar color={color} />
      <View style={styles.accountMain}>
        <Text size={15} weight={600}>
          {account.name}
        </Text>
        <Text mono size={12} color={colors.textMuted}>
          {truncateAddress(account.address)}
        </Text>
      </View>
      <Text size={14} weight={600}>
        {fiat.format(data?.totalChf ?? 0)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Rename ${account.name}`}
        hitSlop={8}
        onPress={() => router.push({ pathname: '/account-name', params: { index: String(account.index) } })}
        style={styles.rename}
      >
        <Icon name="edit" size={18} color={colors.iconMuted} strokeWidth={2} />
      </Pressable>
    </Pressable>
  );
}

/** 09 Accounts & networks */
export default function Accounts() {
  const meta = useWallet((s) => s.meta);
  const selectAccount = useWallet((s) => s.selectAccount);
  const selectNetwork = useWallet((s) => s.selectNetwork);

  // Signed out: this screen is about to unmount.
  if (!meta) return null;

  return (
    <Screen paddingHorizontal={0} paddingBottom={24} gap={12}>
      <View style={styles.gutter}>
        <NavHeader title="Accounts & networks" backIcon="close" />
      </View>

      <Overline accessibilityRole="header" style={styles.sectionLabel}>
        Accounts
      </Overline>
      <View accessibilityRole="radiogroup" accessibilityLabel="Accounts">
        {meta.accounts.map((a) => (
          <AccountRow
            key={a.index}
            account={a}
            selected={a.index === meta.selectedIndex}
            onPress={() => selectAccount(a.index)}
          />
        ))}
      </View>
      <View style={styles.accountActions}>
        <Button
          label="Add account"
          variant="secondary"
          icon="plus"
          iconSize={16}
          iconStrokeWidth={2.4}
          gap={6}
          height={44}
          fontSize={14}
          style={styles.flex}
          // Each account gets its own recovery phrase: create or import one.
          onPress={() => router.replace('/add-account')}
        />
        {/* Hardware wallet pairing (Ledger) has no flow in the design yet. */}
        <Button
          label="Hardware wallet"
          variant="secondary"
          icon="hardwareWallet"
          iconSize={16}
          gap={6}
          height={44}
          fontSize={14}
          style={styles.flex}
        />
      </View>

      <View style={styles.band} />

      <Overline accessibilityRole="header" style={styles.sectionLabel}>
        Networks
      </Overline>
      <View accessibilityRole="radiogroup" accessibilityLabel="Networks">
        {networks.map((n) => {
          const on = n.id === meta.networkId;
          return (
            <Pressable
              key={n.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={n.name}
              onPress={() => selectNetwork(n.id)}
              style={[styles.row, styles.networkRow]}
            >
              <TokenMark label={n.mark} color={colors.primary} size={28} fontSize={11} />
              <Text size={15} weight={600} style={styles.flex}>
                {n.name}
              </Text>
              {on ? <Icon name="check" size={20} strokeWidth={2.4} /> : null}
            </Pressable>
          );
        })}
      </View>
      {/* Custom RPC networks have no flow in the design yet. */}
      <Pressable accessibilityRole="button" style={styles.addNetwork}>
        <Icon name="plus" size={18} color={colors.accentText} strokeWidth={2.4} />
        <Text size={15} weight={600} color={colors.accentText}>
          Add a custom network
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gutter: { paddingHorizontal: 24 },
  sectionLabel: { paddingTop: 8, paddingHorizontal: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  accountRow: { minHeight: 60 },
  accountMain: { flex: 1, gap: 2 },
  rename: { width: 36, height: 36, marginRight: -8, alignItems: 'center', justifyContent: 'center' },
  accountActions: { flexDirection: 'row', gap: 8, paddingTop: 4, paddingHorizontal: 24, paddingBottom: 8 },
  band: { height: 8, backgroundColor: colors.surfaceMuted },
  networkRow: { minHeight: 52, backgroundColor: colors.surface },
  addNetwork: {
    marginTop: 4,
    marginHorizontal: 24,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
