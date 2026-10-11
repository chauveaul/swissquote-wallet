import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/Button';
import { Callout } from '@/components/Callout';
import { NavHeader } from '@/components/Header';
import { PasswordField } from '@/components/PasswordField';
import { Screen, Spacer } from '@/components/Screen';
import { SettingsGroup, SettingsRow } from '@/components/SettingsList';
import { Overline, Text } from '@/components/Text';
import { useToken } from '@/features/market/queries';
import { useSendDraft } from '@/features/send/draft';
import { useFiat } from '@/features/settings/useFiat';
import { confirmUserPresence } from '@/features/wallet/biometrics';
import { useNetworkId, useSelectedAccount, useSwissquote, useWallet } from '@/features/wallet/store';
import { formatNumber, truncateAddress } from '@/lib/format';
import {
  endSwissquoteSession,
  getSwissquoteCustomer,
  hasSwissquoteSession,
  loginSwissquote,
  unlinkSwissquoteAccount,
  withdrawFromSwissquote,
} from '@/services/swissquoteMock';
import { colors, radii } from '@/theme/tokens';

/**
 * Not drawn in the design. The ETH the mock Swissquote server holds in
 * custody for the linked customer (valued in the display currency), with
 * real transfers in both directions on the real chain — see
 * `mock-swissquote/README.md` for what's mocked vs real. Everything here
 * needs a bank session (PIN); unlinking asks for the PIN again.
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
  const [pin, setPin] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [unlinkPin, setUnlinkPin] = useState('');
  // Bumped after sign-in so the (module-level) session is re-read.
  const [, setSessionVersion] = useState(0);
  const signedIn = !!swissquote && hasSwissquoteSession(swissquote.customerId);

  const { data: customer, isRefetching, refetch } = useQuery({
    queryKey: ['swissquote', 'customer', swissquote?.customerId],
    queryFn: getSwissquoteCustomer,
    enabled: signedIn,
    refetchInterval: 15_000,
    retry: false,
  });

  if (!swissquote) return <Redirect href="/link-swissquote" />;

  const signIn = async () => {
    setError(null);
    setSigningIn(true);
    try {
      await loginSwissquote(swissquote.accountNumber, pin);
      setPin('');
      setSessionVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message.split('\n')[0]! : 'Could not sign in.');
    } finally {
      setSigningIn(false);
    }
  };

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
      await withdrawFromSwissquote(networkId, 'ETH', amount);
      setWithdrawAmount('');
      await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: ['portfolio'] })]);
    } catch (e) {
      setError(e instanceof Error ? e.message.split('\n')[0]! : 'Withdrawal failed.');
    } finally {
      setBusy(false);
      setSessionVersion((v) => v + 1);
    }
  };

  const unlink = async () => {
    setError(null);
    setUnlinking(true);
    try {
      // The server's binding is what matters (it decides where withdrawals
      // go), so only forget the link locally once the server has released it.
      await unlinkSwissquoteAccount(unlinkPin);
    } catch (e) {
      setError(e instanceof Error ? e.message.split('\n')[0]! : 'Could not unlink.');
      setUnlinking(false);
      setSessionVersion((v) => v + 1);
      return;
    }
    endSwissquoteSession();
    await unlinkSwissquote();
    router.dismissTo('/settings');
  };

  return (
    <Screen background={colors.surfaceMuted} paddingHorizontal={16} gap={16}>
      <View style={styles.header}>
        <NavHeader title="Swissquote account" onBack={() => router.dismissTo('/settings')} />
      </View>

      <Callout tone="info">
        Demo only: {swissquote.name}’s account lives in a mock server, not a real bank. The
        transfers themselves are real signed transactions on {account.name}’s selected network.
      </Callout>

      {!signedIn ? (
        <View style={styles.withdrawCard}>
          <PasswordField
            label={`PIN for account ${swissquote.accountNumber}`}
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            placeholder="0000"
          />
          <Button label="Sign in to Swissquote" onPress={signIn} loading={signingIn} disabled={pin.length === 0} />
        </View>
      ) : null}

      <View style={styles.balanceCard}>
        <Overline color={colors.onDarkMuted}>Held in custody at Swissquote</Overline>
        <Text size={36} weight={700} color={colors.surface} tracking={-0.02}>
          {signedIn && customer ? `${formatNumber(Number(customer.ethBalance), 4)} ETH` : '···'}
        </Text>
        <Text size={15} color={colors.onDarkMuted}>
          {signedIn && customer ? `≈ ${fiat.format(customer.chfBalance)}` : 'Sign in to see your balance'}
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
          <Button
            label="Withdraw"
            onPress={moveToWallet}
            loading={busy}
            disabled={!signedIn}
            style={styles.withdrawButton}
          />
        </View>
        <Text size={13} color={colors.textMuted}>
          Always lands on {truncateAddress(account.address)} — the address Swissquote already
          verified for this account. Each withdrawal is screened against sanctions lists first.
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
      {signedIn ? (
        <PasswordField
          label="PIN to unlink this wallet"
          value={unlinkPin}
          onChangeText={setUnlinkPin}
          keyboardType="number-pad"
          placeholder="0000"
        />
      ) : null}
      <Button
        label="Unlink this wallet"
        variant="secondary"
        onPress={unlink}
        loading={unlinking}
        disabled={!signedIn || unlinkPin.length === 0}
      />
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
