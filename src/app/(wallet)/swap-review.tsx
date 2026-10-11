import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, router } from 'expo-router';

import { Button } from '@/components/Button';
import { Callout } from '@/components/Callout';
import { NavHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { AccountAvatar } from '@/components/Marks';
import { Screen, Spacer } from '@/components/Screen';
import { Overline, Text } from '@/components/Text';
import { demoQuotes } from '@/features/market/fixtures';
import { appNow, localActivityId, useLocalActivity } from '@/features/market/queries';
import { useFiat } from '@/features/settings/useFiat';
import { QUOTE_TTL_S, quoteSwap, useSwapDraft } from '@/features/swap/quote';
import { accountColor } from '@/features/wallet/accountColor';
import { confirmUserPresence } from '@/features/wallet/biometrics';
import { useNetworkId, useSelectedAccount } from '@/features/wallet/store';
import { DEMO_MODE } from '@/lib/config';
import { formatNumber } from '@/lib/format';
import { getNetwork } from '@/lib/networks';
import { colors, radii } from '@/theme/tokens';

/**
 * Review swap. The design links "Review swap" to the Review screen (06); this
 * is that screen adapted to a swap, so nothing is submitted before the user
 * has seen the full quote and confirmed it.
 */
export default function SwapReview() {
  const fiat = useFiat();
  const account = useSelectedAccount();
  const networkId = useNetworkId();
  const network = getNetwork(networkId);
  const addActivity = useLocalActivity((s) => s.add);
  const { flipped, pay, reset } = useSwapDraft();
  const [secondsLeft, setSecondsLeft] = useState(QUOTE_TTL_S);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const expired = secondsLeft <= 0;

  useEffect(() => {
    if (expired) return;
    const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [expired]);

  const payValue = Number(pay) || 0;
  if (!(payValue > 0)) return <Redirect href="/swap" />;

  const q = quoteSwap(flipped, payValue);
  const paid = `${formatNumber(q.pay, q.from.decimals)} ${q.from.symbol}`;
  const received = `${formatNumber(q.receive, q.to.decimals)} ${q.to.symbol}`;
  const minReceived = `${formatNumber(q.minReceive, q.to.decimals)} ${q.to.symbol}`;

  const rows: [string, string][] = [
    ['Network', network.name],
    ['Rate', q.rateLabel],
    ['Minimum received', minReceived],
    ['Max. slippage', `${q.slippagePct}%`],
    ['Best of quotes', q.providers],
    ['Network fee', fiat.format(q.networkFeeChf)],
    ['Swissquote fee', q.swissquoteFee],
  ];

  const confirm = async () => {
    setError(null);
    if (!DEMO_MODE) {
      setError('Swaps are not available yet.');
      return;
    }
    // Lock before the biometric prompt: `busy` only lands on the next render,
    // so a second tap while the prompt is open would start another swap.
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    if (!(await confirmUserPresence('Confirm swap'))) {
      inFlight.current = false;
      setBusy(false);
      return;
    }
    addActivity({
      id: localActivityId(),
      kind: 'swap',
      title: `Swapped ${q.from.symbol} → ${q.to.symbol}`,
      status: 'pending',
      eta: demoQuotes.feeEta.market,
      amount: `+ ${received}`,
      valueChf: q.receiveChf,
      timestamp: appNow(),
      accountIndex: account.index,
      networkId,
      fee: { chf: q.networkFeeChf },
      swap: { paid: `− ${paid}`, received: `+ ${received}`, rate: q.rateLabel, minReceived },
    });
    reset();
    router.dismissTo('/activity');
  };

  return (
    <Screen gap={16}>
      <NavHeader title="Review swap" />

      <View style={styles.summary}>
        <Overline>You pay</Overline>
        <Text size={28} weight={700} tracking={-0.02}>
          {paid}
        </Text>
        <Text size={15} color={colors.textSecondary}>
          ≈ {fiat.format(q.payChf)}
        </Text>
        <View style={styles.arrow}>
          <Icon name="arrowDown" size={20} color={colors.textMuted} />
        </View>
        <Overline>You receive (estimated)</Overline>
        <Text size={28} weight={700} tracking={-0.02}>
          {received}
        </Text>
        <Text size={15} color={colors.textSecondary}>
          ≈ {fiat.format(q.receiveChf)}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={[styles.row, styles.rowDivider]}>
          <Text size={14} color={colors.textSecondary}>
            Account
          </Text>
          <View style={styles.inline}>
            <AccountAvatar color={accountColor(account.index)} size={20} />
            <Text size={14} weight={600}>
              {account.name}
            </Text>
          </View>
        </View>
        {rows.map(([label, value], i) => (
          <View key={label} style={[styles.row, i < rows.length - 1 && styles.rowDivider]}>
            <Text size={14} color={colors.textSecondary}>
              {label}
            </Text>
            <Text size={14} weight={600}>
              {value}
            </Text>
          </View>
        ))}
      </View>

      <Callout tone="info" size={13}>
        You’ll receive at least {minReceived}. If the price moves more than {q.slippagePct}% before the swap executes,
        it’s cancelled and only the network fee is charged.
      </Callout>

      <Spacer />

      <View style={styles.footer}>
        {error ? (
          <Text accessibilityRole="alert" size={13} weight={600} color={colors.accentText} align="center">
            {error}
          </Text>
        ) : null}
        <Text
          size={12}
          color={expired ? colors.accentText : colors.textMuted}
          weight={expired ? 600 : 400}
          align="center"
        >
          {expired ? 'This quote has expired. Refresh it to see the latest price.' : `Quote valid for ${secondsLeft} s`}
        </Text>
        <View style={styles.actions}>
          <Button label="Cancel" variant="secondary" style={styles.flex} onPress={() => router.back()} />
          {expired ? (
            <Button label="Refresh quote" style={styles.flex} onPress={() => setSecondsLeft(QUOTE_TTL_S)} />
          ) : (
            <Button label="Confirm" style={styles.flex} onPress={confirm} loading={busy} />
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { alignItems: 'center', gap: 2, paddingTop: 4 },
  arrow: { paddingVertical: 2 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footer: { gap: 10 },
  actions: { flexDirection: 'row', gap: 12 },
});
