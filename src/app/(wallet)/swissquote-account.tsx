import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/Button';
import { Callout } from '@/components/Callout';
import { NavHeader } from '@/components/Header';
import { PasswordField } from '@/components/PasswordField';
import { Screen, Spacer } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SettingsGroup, SettingsRow } from '@/components/SettingsList';
import { Overline, Text } from '@/components/Text';
import { showToast } from '@/components/Toast';
import { appNow, useLocalActivity, useSpotPrice } from '@/features/market/queries';
import type { TransferAsset } from '@/features/market/types';
import { useFiat } from '@/features/settings/useFiat';
import { confirmUserPresence } from '@/features/wallet/biometrics';
import { useNetworkId, useSelectedAccount, useSwissquote, useWallet } from '@/features/wallet/store';
import { formatNumber, truncateAddress } from '@/lib/format';
import { estimateTransferFee, getAssetBalance, sendAsset } from '@/services/chain';
import {
  endSwissquoteSession,
  getSwissquoteCustomer,
  hasSwissquoteSession,
  loginSwissquote,
  unlinkSwissquoteAccount,
  withdrawFromSwissquote,
} from '@/services/swissquoteMock';
import { colors, radii } from '@/theme/tokens';

const ASSETS: { value: TransferAsset; label: string }[] = [
  { value: 'ETH', label: 'ETH' },
  { value: 'USDC', label: 'USDC' },
  { value: 'LINK', label: 'LINK' },
];
const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: 'toSwissquote', label: 'To Swissquote' },
  { value: 'toWallet', label: 'To wallet' },
];
type Direction = 'toSwissquote' | 'toWallet';

/**
 * Not drawn in the design. What the mock Swissquote server holds in custody
 * for the linked customer (per asset, valued in the display currency), with
 * one unified transfer flow for ETH/USDC/LINK in both directions, real on
 * the real chain either way — see `mock-swissquote/README.md` for exactly
 * what's mocked vs real. Everything here needs a bank session (PIN);
 * unlinking asks for the PIN again.
 */
export default function SwissquoteAccount() {
  const fiat = useFiat();
  const swissquote = useSwissquote();
  const unlinkSwissquote = useWallet((s) => s.unlinkSwissquote);
  const getSigner = useWallet((s) => s.getSigner);
  const account = useSelectedAccount();
  const networkId = useNetworkId();
  const addActivity = useLocalActivity((s) => s.add);
  const queryClient = useQueryClient();

  const [direction, setDirection] = useState<Direction>('toSwissquote');
  const [asset, setAsset] = useState<TransferAsset>('ETH');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [unlinkPin, setUnlinkPin] = useState('');
  // Bumped after sign-in or a failed call so the (module-level) session is re-read.
  const [, setSessionVersion] = useState(0);
  const signedIn = !!swissquote && hasSwissquoteSession(swissquote.customerId);

  const priceChf = useSpotPrice(asset);

  const { data: customer, isRefetching, refetch } = useQuery({
    queryKey: ['swissquote', 'customer', swissquote?.customerId],
    queryFn: getSwissquoteCustomer,
    enabled: signedIn,
    refetchInterval: 15_000,
    retry: false,
  });

  const { data: walletBalance } = useQuery({
    queryKey: ['swissquote', 'walletBalance', account.address, networkId, asset],
    queryFn: () => getAssetBalance(networkId, asset, account.address),
    refetchInterval: 15_000,
  });
  const walletAmount = Number(walletBalance?.formatted ?? '0');

  if (!swissquote) return <Redirect href="/link-swissquote" />;

  // Custody: only what Swissquote holds for the customer in this asset can come back.
  const maxFromSwissquote = signedIn && customer ? Number(customer.holdings[asset]) : 0;

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

  const move = async () => {
    setError(null);
    const amountNum = Number(amount);
    if (!(amountNum > 0)) {
      setError('Enter an amount.');
      return;
    }
    const approved = await confirmUserPresence(direction === 'toSwissquote' ? 'Move to Swissquote' : 'Withdraw from Swissquote');
    if (!approved) return;
    setBusy(true);
    try {
      if (direction === 'toSwissquote') {
        if (amountNum > walletAmount) throw new Error(`Insufficient ${asset} balance.`);
        const hash = await sendAsset({
          signer: getSigner(account.index),
          networkId,
          asset,
          to: swissquote.custodialAddress,
          amount,
          speed: 'market',
        });
        const { feeEth } = await estimateTransferFee(networkId, asset, 'market');
        addActivity({
          id: hash,
          kind: 'send',
          title: 'Moved to Swissquote',
          status: 'pending',
          amount: `− ${formatNumber(amountNum, 4)} ${asset}`,
          valueChf: priceChf === null ? null : amountNum * priceChf,
          timestamp: appNow(),
          hash,
          accountIndex: account.index,
          networkId,
          counterparty: { label: `Swissquote (${swissquote.name})`, address: swissquote.custodialAddress },
          fee: { native: `${formatNumber(feeEth, 5)} ETH`, chf: null },
          swissquoteCustomerId: swissquote.customerId,
          swissquoteAsset: asset,
        });
        showToast(`Sent — waiting for the chain to confirm.`);
      } else {
        if (amountNum > maxFromSwissquote) throw new Error(`Insufficient ${asset} held at Swissquote.`);
        const { txHash } = await withdrawFromSwissquote(networkId, asset, amount);
        showToast(`Withdrawal sent — ${truncateAddress(txHash)}.`);
        await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: ['swissquote', 'walletBalance'] })]);
      }
      setAmount('');
    } catch (e) {
      setError(e instanceof Error ? e.message.split('\n')[0]! : 'Transfer failed.');
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

  const available = direction === 'toSwissquote' ? walletAmount : maxFromSwissquote;

  return (
    <Screen background={colors.surfaceMuted} paddingHorizontal={16} gap={16}>
      <View style={styles.header}>
        <NavHeader title="Swissquote account" onBack={() => router.dismissTo('/settings')} />
      </View>

      <Callout tone="info">
        You’re in demo mode: {swissquote.name}’s Swissquote balance shown below is a sample account, not a
        connected bank account. Transfers you make are still real, signed transactions on {account.name}’s
        selected network.
      </Callout>

      {!signedIn ? (
        <View style={styles.moveCard}>
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
          {signedIn && customer ? fiat.format(customer.chfBalance) : '···'}
        </Text>
        <Text size={13} color={colors.onDarkMuted}>
          {signedIn && customer
            ? ASSETS.map((a) => `${formatNumber(Number(customer.holdings[a.value]), 4)} ${a.label}`).join(' · ')
            : 'Sign in to see your balance'}
        </Text>
        <Text size={13} color={colors.onDarkMuted}>
          Account {swissquote.accountNumber} · linked {new Date(swissquote.linkedAt).toLocaleDateString()}
        </Text>
      </View>

      <Callout tone="info" size={13}>
        Keep your crypto one tap from your Swissquote account instead of a separate wallet to
        manage — your keys stay yours, and your assets stay in the Swissquote ecosystem.
      </Callout>

      <SettingsGroup label="Display">
        <SettingsRow label="Currency" value={fiat.code} onPress={() => router.push('/currency')} last />
      </SettingsGroup>

      <SettingsGroup label="Linked wallet">
        <SettingsRow label="Custodial address" detail={truncateAddress(swissquote.custodialAddress)} mono />
        <SettingsRow label={`Wallet balance (${asset})`} value={formatNumber(walletAmount, 4)} last />
      </SettingsGroup>

      <View style={styles.moveCard}>
        <Overline>Move money</Overline>
        <SegmentedControl accessibilityLabel="Direction" options={DIRECTIONS} value={direction} onChange={setDirection} />
        <SegmentedControl accessibilityLabel="Asset" options={ASSETS} value={asset} onChange={setAsset} />
        <View style={styles.moveRow}>
          <TextInput
            accessibilityLabel={`Amount in ${asset}`}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.0000"
            placeholderTextColor={colors.iconMuted}
            keyboardType="decimal-pad"
            inputMode="decimal"
            style={styles.moveInput}
          />
          <Button
            label="Move"
            onPress={move}
            loading={busy}
            disabled={direction === 'toWallet' && !signedIn}
            style={styles.moveButton}
          />
        </View>
        <Text size={13} color={colors.textMuted}>
          Available: {formatNumber(available, 4)} {asset}
        </Text>
        <Text size={13} color={colors.textMuted}>
          {direction === 'toSwissquote'
            ? `Sent to your Swissquote account's deposit address. Only deposits from your verified wallet are credited.`
            : `Always sent to ${truncateAddress(account.address)}, the wallet address already verified for this account, after a sanctions check.`}
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
  moveCard: { gap: 10 },
  moveRow: { flexDirection: 'row', gap: 8 },
  moveInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    fontSize: 16,
    color: colors.ink,
  },
  moveButton: { width: 100 },
});
