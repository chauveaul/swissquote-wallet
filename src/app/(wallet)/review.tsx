import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Redirect, router } from 'expo-router';

import { Button } from '@/components/Button';
import { NavHeader } from '@/components/Header';
import { AccountAvatar } from '@/components/Marks';
import { Screen, Spacer } from '@/components/Screen';
import { Overline, Text } from '@/components/Text';
import { demoQuotes } from '@/features/market/fixtures';
import { appNow, localActivityId, useLocalActivity } from '@/features/market/queries';
import type { FeeSpeed } from '@/features/market/types';
import { feeFor, findContact, parseRecipient, useSendDraft } from '@/features/send/draft';
import { accountColor } from '@/features/wallet/accountColor';
import { confirmUserPresence } from '@/features/wallet/biometrics';
import { useNetworkId, useSelectedAccount, useWallet } from '@/features/wallet/store';
import { DEMO_MODE } from '@/lib/config';
import { formatChf, formatNumber, truncateAddress } from '@/lib/format';
import { getNetwork } from '@/lib/networks';
import { sendNative } from '@/services/chain';
import { colors, radii } from '@/theme/tokens';

const SPEEDS: { id: FeeSpeed; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'market', label: 'Market' },
  { id: 'fast', label: 'Fast' },
];

/** 06 Review transaction */
export default function Review() {
  const account = useSelectedAccount();
  const networkId = useNetworkId();
  const network = getNetwork(networkId);
  const getSigner = useWallet((s) => s.getSigner);
  const addActivity = useLocalActivity((s) => s.add);
  const { to, amount, speed, setSpeed, reset } = useSendDraft();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recipient = parseRecipient(to);
  if (!recipient || !(Number(amount) > 0)) return <Redirect href="/send" />;

  const contact = findContact(recipient);
  const value = Number(amount);
  const fee = feeFor(speed);
  const total = value + fee.eth;

  const confirm = async () => {
    setError(null);
    const approved = await confirmUserPresence('Confirm transaction');
    if (!approved) return;
    setBusy(true);
    try {
      let hash: `0x${string}` | undefined;
      if (!DEMO_MODE) {
        hash = await sendNative({ signer: getSigner(account.index), networkId, to: recipient, amount, speed });
      }
      addActivity({
        id: hash ?? localActivityId(),
        kind: 'send',
        title: 'Sent ETH',
        status: 'pending',
        eta: fee.eta,
        amount: `− ${formatNumber(value, 4)} ETH`,
        fiat: formatChf(value * demoQuotes.ethChf),
        timestamp: appNow(),
        hash,
        accountIndex: account.index,
        networkId,
        counterparty: { label: contact?.name, address: recipient },
        fee: `${formatNumber(fee.eth, 5)} ETH · ${formatChf(fee.chf)}`,
      });
      reset();
      router.dismissTo('/activity');
    } catch (e) {
      setError(e instanceof Error ? e.message.split('\n')[0]! : 'The transaction could not be sent.');
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
          ≈ {formatChf(value * demoQuotes.ethChf)}
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
          <View style={styles.toValue} accessible accessibilityLabel={`To ${contact?.name ?? 'new address'}, ${recipient}`}>
            <Text size={14} weight={600}>
              {contact?.name ?? 'New address'}
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
          <Text size={14} weight={600}>
            {formatNumber(fee.eth, 5)} ETH · {formatChf(fee.chf)}
          </Text>
        </View>
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
            ≈ {formatChf(total * demoQuotes.ethChf)}
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
        <Button label="Confirm" style={styles.flex} onPress={confirm} loading={busy} />
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
