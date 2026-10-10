import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/Button';
import { Callout } from '@/components/Callout';
import { NavHeader } from '@/components/Header';
import { Screen, Spacer } from '@/components/Screen';
import { SettingsGroup, SettingsRow } from '@/components/SettingsList';
import { Overline, Text } from '@/components/Text';
import { useToken } from '@/features/market/queries';
import { useSendDraft } from '@/features/send/draft';
import { useFiat } from '@/features/settings/useFiat';
import { confirmUserPresence } from '@/features/wallet/biometrics';
import { useNetworkId, useSelectedAccount, useSwissquote, useWallet } from '@/features/wallet/store';
import { formatNumber, truncateAddress } from '@/lib/format';
import { getSwissquoteCustomer, unlinkSwissquoteAccount, withdrawFromSwissquote } from '@/services/swissquoteMock';
import { colors, radii } from '@/theme/tokens';

/**
 * Not drawn in the design. The linked mock Swissquote account's CHF balance,
 * with real transfers in both directions on the real chain — see
 * `mock-swissquote/README.md` for what's mocked vs real.
 */
export default function SwissquoteAccount() {
  const fiat = useFiat();
  const swissquote = useSwissquote();
  const unlinkSwissquote = useWallet((s) => s.unlinkSwissquote);
  const account = useSelectedAccount();
  const networkId = useNetworkId();
  const eth = useToken(account.index, 'ETH');
  const setTo = useSendDraft((s) => s.setTo);
  const queryClient = useQueryClient();
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: customer, isRefetching, refetch } = useQuery({
    queryKey: ['swissquote', 'customer', swissquote?.customerId],
    queryFn: () => getSwissquoteCustomer(swissquote!.customerId),
    enabled: !!swissquote,
    refetchInterval: 15_000,
  });

  if (!swissquote) return <Redirect href="/link-swissquote" />;

  const moveToSwissquote = () => {
    setTo(swissquote.custodialAddress);
    router.push('/send');
  };

  const moveToWallet = async () => {
    setError(null);
    const amount = withdrawAmount;
    if (!(Number(amount) > 0)) {
      setError('Enter an amount.');
      return;
    }
    const approved = await confirmUserPresence('Withdraw from Swissquote');
    if (!approved) return;
    setBusy(true);
    try {
      await withdrawFromSwissquote(swissquote.customerId, networkId, 'ETH', amount);
      setWithdrawAmount('');
      await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: ['portfolio'] })]);
    } catch (e) {
      setError(e instanceof Error ? e.message.split('\n')[0]! : 'Withdrawal failed.');
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    setError(null);
    setUnlinking(true);
    try {
      // Best-effort: tell the server first so the customer is actually free
      // to re-link (otherwise it still thinks this address owns them, and
      // picking them again on /link-swissquote fails with "already linked").
      await unlinkSwissquoteAccount(swissquote.customerId);
    } catch (e) {
      console.warn('[swissquote] server-side unlink failed, unlinking locally anyway:', e);
    }
    await unlinkSwissquote();
    router.dismissTo('/settings');
  };

  return (
    <Screen background={colors.surfaceMuted} paddingHorizontal={16} gap={16}>
      <View style={styles.header}>
        <NavHeader title="Swissquote account" />
      </View>

      <Callout tone="info">
        Demo only: {swissquote.name}’s CHF balance below lives in a mock server, not a real bank.
        The transfers themselves are real signed transactions on {account.name}’s selected network.
      </Callout>

      <View style={styles.balanceCard}>
        <Overline color={colors.onDarkMuted}>Swissquote balance</Overline>
        <Text size={36} weight={700} color={colors.surface} tracking={-0.02}>
          {customer ? fiat.format(customer.chfBalance) : '···'}
        </Text>
        <Text size={13} color={colors.onDarkMuted}>
          Account {swissquote.accountNumber} · linked {new Date(swissquote.linkedAt).toLocaleDateString()}
        </Text>
      </View>

      <SettingsGroup label="Display">
        <SettingsRow
          label="Currency"
          value={fiat.code}
          onPress={() => router.push('/currency')}
          last
        />
      </SettingsGroup>

      <SettingsGroup label="Linked wallet">
        <SettingsRow label="Custodial address" detail={truncateAddress(swissquote.custodialAddress)} mono />
        <SettingsRow label="Wallet balance" value={`${formatNumber(eth?.amount ?? 0, 4)} ETH`} last />
      </SettingsGroup>

      <Button label="Move ETH to Swissquote" onPress={moveToSwissquote} />

      <View style={styles.withdrawCard}>
        <Overline>Move ETH to wallet</Overline>
        <View style={styles.withdrawRow}>
          <TextInput
            accessibilityLabel="Amount in ETH"
            value={withdrawAmount}
            onChangeText={setWithdrawAmount}
            placeholder="0.0000"
            placeholderTextColor={colors.iconMuted}
            keyboardType="decimal-pad"
            inputMode="decimal"
            style={styles.withdrawInput}
          />
          <Button label="Withdraw" onPress={moveToWallet} loading={busy} style={styles.withdrawButton} />
        </View>
        <Text size={13} color={colors.textMuted}>
          Always lands on {truncateAddress(account.address)} — the address Swissquote already
          verified for this account. That’s the Travel Rule check, made automatic.
        </Text>
      </View>

      {error ? (
        <Text accessibilityRole="alert" size={13} weight={600} color={colors.accentText}>
          {error}
        </Text>
      ) : null}

      <Spacer />
      {isRefetching ? (
        <Text size={12} color={colors.textMuted} align="center">
          Refreshing…
        </Text>
      ) : null}
      <Button label="Unlink this device" variant="secondary" onPress={unlink} loading={unlinking} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 8 },
  balanceCard: {
    backgroundColor: colors.ink,
    borderRadius: radii.sm,
    padding: 20,
    gap: 6,
  },
  withdrawCard: { gap: 10 },
  withdrawRow: { flexDirection: 'row', gap: 8 },
  withdrawInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    fontSize: 16,
    color: colors.ink,
  },
  withdrawButton: { width: 120 },
});
