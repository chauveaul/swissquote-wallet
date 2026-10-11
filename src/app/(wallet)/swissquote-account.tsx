import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/Button';
import { Callout } from '@/components/Callout';
import { NavHeader } from '@/components/Header';
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
import { getSwissquoteCustomer, unlinkSwissquoteAccount, withdrawFromSwissquote } from '@/services/swissquoteMock';
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
 * Not drawn in the design. The linked mock Swissquote account's CHF balance,
 * with one unified transfer flow for ETH/USDC/LINK in both directions, real
 * on the real chain either way — see `mock-swissquote/README.md` for
 * exactly what's mocked vs real.
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

  const priceChf = useSpotPrice(asset);

  const { data: customer, isRefetching, refetch } = useQuery({
    queryKey: ['swissquote', 'customer', swissquote?.customerId],
    queryFn: () => getSwissquoteCustomer(swissquote!.customerId),
    enabled: !!swissquote,
    refetchInterval: 15_000,
  });

  const { data: walletBalance } = useQuery({
    queryKey: ['swissquote', 'walletBalance', account.address, networkId, asset],
    queryFn: () => getAssetBalance(networkId, asset, account.address),
    refetchInterval: 15_000,
  });
  const walletAmount = Number(walletBalance?.formatted ?? '0');

  if (!swissquote) return <Redirect href="/link-swissquote" />;

  // How much of `asset` the Swissquote balance can cover, at the live rate.
  const maxFromSwissquote = priceChf && customer ? customer.chfBalance / priceChf : 0;

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
        if (amountNum > maxFromSwissquote) throw new Error('Insufficient Swissquote balance.');
        const { txHash } = await withdrawFromSwissquote(swissquote.customerId, networkId, asset, amount);
        showToast(`Withdrawal sent — ${truncateAddress(txHash)}.`);
        await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: ['swissquote', 'walletBalance'] })]);
      }
      setAmount('');
    } catch (e) {
      setError(e instanceof Error ? e.message.split('\n')[0]! : 'Transfer failed.');
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

  const available = direction === 'toSwissquote' ? walletAmount : maxFromSwissquote;

  return (
    <Screen background={colors.surfaceMuted} paddingHorizontal={16} gap={16}>
      <View style={styles.header}>
        <NavHeader title="Swissquote account" onBack={() => router.dismissTo('/settings')} />
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
          <Button label="Move" onPress={move} loading={busy} style={styles.moveButton} />
        </View>
        <Text size={13} color={colors.textMuted}>
          Available: {formatNumber(available, 4)} {asset}
        </Text>
        <Text size={13} color={colors.textMuted}>
          {direction === 'toSwissquote'
            ? `Sent to Swissquote's custodial address — only a verified wallet can land here.`
            : `Always lands on ${truncateAddress(account.address)} — the address Swissquote already verified for this account. That's the Travel Rule check, made automatic.`}
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
