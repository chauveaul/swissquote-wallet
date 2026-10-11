import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Redirect, router } from 'expo-router';

import { Button } from '@/components/Button';
import { NavHeader } from '@/components/Header';
import { AccountAvatar } from '@/components/Marks';
import { Screen, Spacer } from '@/components/Screen';
import { Overline, Text } from '@/components/Text';
import { demoQuotes } from '@/features/market/fixtures';
import { appNow, localActivityId, useFeeEstimate, useLocalActivity, useSpotPrice } from '@/features/market/queries';
import { useFiat } from '@/features/settings/useFiat';
import type { Contact, FeeSpeed } from '@/features/market/types';
import { parseRecipient, useSendDraft } from '@/features/send/draft';
import { useSponsorship } from '@/features/send/gasless';
import { identifyRecipient } from '@/features/send/recipient';
import { accountColor } from '@/features/wallet/accountColor';
import { confirmUserPresence } from '@/features/wallet/biometrics';
import { useNetworkId, useSelectedAccount, useSwissquote, useWallet, type AccountMeta } from '@/features/wallet/store';
import { DEMO_MODE } from '@/lib/config';
import { formatNumber, truncateAddress } from '@/lib/format';
import { getNetwork } from '@/lib/networks';
import { sendNative } from '@/services/chain';
import { sendNativeGasless } from '@/services/gasless';
import { colors, radii } from '@/theme/tokens';

const SPEEDS: { id: FeeSpeed; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'market', label: 'Market' },
  { id: 'fast', label: 'Fast' },
];

/** 06 Review transaction */
const NO_CONTACTS: Contact[] = [];
const NO_ACCOUNTS: AccountMeta[] = [];

export default function Review() {
  const fiat = useFiat();
  const account = useSelectedAccount();
  const networkId = useNetworkId();
  const network = getNetwork(networkId);
  const getSigner = useWallet((s) => s.getSigner);
  const contacts = useWallet((s) => s.meta?.contacts ?? NO_CONTACTS);
  const ethChf = useSpotPrice('ETH');
  const accounts = useWallet((s) => s.meta?.accounts ?? NO_ACCOUNTS);
  const swissquote = useSwissquote();
  const addActivity = useLocalActivity((s) => s.add);
  const { to, amount, speed, setSpeed, reset } = useSendDraft();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the user opts out of sponsorship, or the paymaster refused it at confirmation.
  const [payInEth, setPayInEth] = useState(false);

  const { data: ethFee } = useFeeEstimate(networkId, speed, ethChf);
  const recipient = parseRecipient(to);
  const known = identifyRecipient(recipient, account.index, accounts, contacts, swissquote);
  // Swissquote verifies deposits as plain top-level transfers, so they always pay their own gas.
  const { sponsorship, loading: checkingSponsor } = useSponsorship(
    networkId,
    account.index,
    account.address,
    known?.kind !== 'swissquote',
  );
  const gasless = !payInEth && sponsorship?.sponsored === true;
  const fee = gasless ? { eth: 0, chf: 0, eta: ethFee?.eta } : ethFee;

  if (!recipient || !(Number(amount) > 0) || !fee) return <Redirect href="/send" />;

  // Never confirm a transfer to the sending account itself.
  if (known?.kind === 'self') return <Redirect href="/send" />;
  const toName = known
    ? known.kind === 'account'
      ? `${known.name} (yours)`
      : known.kind === 'swissquote'
        ? `Swissquote · ${known.name}`
        : known.name
    : 'New address';
  const value = Number(amount);
  const total = value + fee.eth;

  const confirm = async () => {
    setError(null);
    const approved = await confirmUserPresence('Confirm transaction');
    if (!approved) return;
    setBusy(true);
    try {
      let hash: `0x${string}` | undefined;
      let userOpHash: `0x${string}` | undefined;
      if (!DEMO_MODE) {
        const signer = getSigner(account.index);
        if (gasless) {
          try {
            userOpHash = await sendNativeGasless({ signer, networkId, to: recipient, amount });
          } catch (e) {
            // Like MetaMask: never block the send on sponsorship — offer the regular fee instead.
            setPayInEth(true);
            setError(`Gas sponsorship failed (${firstLine(e)}). Review the network fee and confirm again.`);
            setBusy(false);
            return;
          }
        } else {
          hash = await sendNative({ signer, networkId, to: recipient, amount, speed });
        }
      }
      addActivity({
        id: hash ?? userOpHash ?? localActivityId(),
        kind: 'send',
        title: known?.kind === 'swissquote' ? 'Moved to Swissquote' : 'Sent ETH',
        status: 'pending',
        eta: fee.eta,
        amount: `− ${formatNumber(value, 4)} ETH`,
        valueChf: ethChf === null ? null : value * ethChf,
        timestamp: appNow(),
        hash,
        userOpHash,
        accountIndex: account.index,
        networkId,
        counterparty: { label: known?.name, address: recipient },
        fee: gasless ? { native: 'Sponsored', chf: 0 } : { native: `${formatNumber(fee.eth, 5)} ETH`, chf: fee.chf },
        // The confirmation poller (root layout) notifies the mock server once
        // this is actually mined — not here, since the tx may not be mined
        // yet and a one-shot attempt with no retry can silently lose it.
        swissquoteCustomerId: known?.kind === 'swissquote' ? swissquote?.customerId : undefined,
        swissquoteAsset: known?.kind === 'swissquote' ? 'ETH' : undefined,
      });
      reset();
      router.dismissTo('/activity');
    } catch (e) {
      setError(e instanceof Error ? firstLine(e) : 'The transaction could not be sent.');
      setBusy(false);
    }
  };

  return (
    <Screen gap={20}>
      <NavHeader title="Review" />

      <View style={styles.summary}>
        <Overline>You are sending</Overline>
        <Text size={40} weight={700} tracking={-0.02}>
          {formatNumber(value, 4)} ETH
        </Text>
        <Text size={15} color={colors.textSecondary}>
          ≈ {fiat.format(ethChf === null ? null : value * ethChf)}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={[styles.row, styles.rowDivider]}>
          <Text size={14} color={colors.textSecondary}>
            From
          </Text>
          <View style={styles.inline}>
            <AccountAvatar color={accountColor(account.index)} size={20} />
            <Text size={14} weight={600}>
              {account.name}
            </Text>
          </View>
        </View>
        <View style={[styles.row, styles.rowDivider]}>
          <Text size={14} color={colors.textSecondary}>
            To
          </Text>
          <View style={styles.toValue} accessible accessibilityLabel={`To ${toName}, ${recipient}`}>
            <Text size={14} weight={600}>
              {toName}
            </Text>
            <Text mono size={12} color={colors.textMuted}>
              {truncateAddress(recipient)}
            </Text>
          </View>
        </View>
        <View style={styles.row}>
          <Text size={14} color={colors.textSecondary}>
            Network
          </Text>
          <Text size={14} weight={600}>
            {network.name}
          </Text>
        </View>
      </View>

      <View style={styles.fees}>
        <View style={styles.feeHeader}>
          <Overline>Network fee</Overline>
          {gasless ? (
            <Text size={14} weight={600} color={colors.positive}>
              Free · Sponsored
            </Text>
          ) : (
            <Text size={14} weight={600}>
              {checkingSponsor ? 'Checking sponsorship…' : `${formatNumber(fee.eth, 5)} ETH · ${fiat.format(fee.chf)}`}
            </Text>
          )}
        </View>
        {gasless ? (
          <View style={styles.sponsored}>
            <Text size={13} color={colors.textSecondary} style={styles.flex}>
              You don’t need ETH for gas. The first gasless send also upgrades this address to a smart account
              (EIP-7702) — same address, same recovery phrase.
            </Text>
            <Pressable accessibilityRole="button" onPress={() => setPayInEth(true)} hitSlop={8}>
              <Text size={13} weight={600} color={colors.accentText}>
                Pay in ETH
              </Text>
            </Pressable>
          </View>
        ) : (
          <View accessibilityRole="radiogroup" accessibilityLabel="Fee speed" style={styles.speeds}>
            {SPEEDS.map((s) => {
              const on = s.id === speed;
              return (
                <Pressable
                  key={s.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setSpeed(s.id)}
                  style={[styles.speed, on ? { ...styles.speedOn, borderColor: colors.accent } : styles.speedOff]}
                >
                  <Text size={14} weight={700}>
                    {s.label}
                  </Text>
                  <Text size={12}>{demoQuotes.feeEta[s.id]}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.total}>
        <Text size={16} weight={700}>
          Total
        </Text>
        <View style={styles.totalValue}>
          <Text size={18} weight={700}>
            {formatNumber(total, 5)} ETH
          </Text>
          <Text size={13} color={colors.textSecondary}>
            ≈ {fiat.format(ethChf === null ? null : total * ethChf)}
          </Text>
        </View>
      </View>

      <Spacer />

      {error ? (
        <Text accessibilityRole="alert" size={13} weight={600} color={colors.accentText} align="center">
          {error}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button label="Cancel" variant="secondary" style={styles.flex} onPress={() => router.back()} />
        <Button label="Confirm" style={styles.flex} onPress={confirm} loading={busy || checkingSponsor} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { alignItems: 'center', gap: 6, paddingTop: 12, paddingBottom: 4 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toValue: { alignItems: 'flex-end', gap: 2 },
  fees: { gap: 10 },
  sponsored: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  feeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  speeds: { flexDirection: 'row', gap: 8 },
  speed: {
    flex: 1,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radii.sm,
  },
  speedOn: { backgroundColor: colors.accentSurface, borderWidth: 2 },
  speedOff: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: 12,
    borderTopWidth: 1.5,
    borderTopColor: colors.ink,
  },
  totalValue: { alignItems: 'flex-end', gap: 2 },
  actions: { flexDirection: 'row', gap: 12 },
});

function firstLine(e: unknown): string {
  return e instanceof Error ? e.message.split('\n')[0]! : String(e);
}
