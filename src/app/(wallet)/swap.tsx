import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { NavHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { TokenPill } from '@/components/Marks';
import { Screen, Spacer } from '@/components/Screen';
import { Overline, Text } from '@/components/Text';
import { usePortfolio } from '@/features/market/queries';
import { useFiat } from '@/features/settings/useFiat';
import { QUOTE_TTL_S, quoteSwap, useSwapDraft } from '@/features/swap/quote';
import { useSelectedAccount } from '@/features/wallet/store';
import { formatNumber } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

/** 08 Swap */
export default function Swap() {
  const fiat = useFiat();
  const account = useSelectedAccount();
  const { data: portfolio } = usePortfolio(account.index);
  const { flipped, pay, setFlipped, setPay } = useSwapDraft();
  const [secondsLeft, setSecondsLeft] = useState(QUOTE_TTL_S);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setSecondsLeft((s) => (s <= 1 ? QUOTE_TTL_S : s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const payValue = Number(pay) || 0;
  const quote = quoteSwap(flipped, payValue);
  const { from, to } = quote;
  const receiveValue = quote.receive;
  const payChf = quote.payChf;
  const receiveChf = quote.receiveChf;
  const balance = portfolio?.tokens.find((t) => t.symbol === from.symbol)?.amount ?? 0;

  const details: [string, string][] = [
    ['Rate', quote.rateLabel],
    ['Best of quotes', quote.providers],
    ['Max. slippage', `${quote.slippagePct}%`],
    ['Network fee', fiat.format(quote.networkFeeChf)],
    ['Swissquote fee', quote.swissquoteFee],
  ];

  // Nothing is submitted here: the review screen shows the full quote first.
  const review = () => {
    setError(null);
    if (payValue <= 0) return setError('Enter an amount to swap.');
    if (payValue > balance) return setError(`Insufficient ${from.symbol} balance.`);
    router.push('/swap-review');
  };

  return (
    <Screen gap={20}>
      <NavHeader
        title="Swap"
        right={
          // Slippage / routing settings have no screen in the design yet.
          <Pressable accessibilityRole="button" accessibilityLabel="Swap settings" style={styles.settings}>
            <Icon name="sliders" size={22} />
          </Pressable>
        }
      />

      <View style={styles.panels}>
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Overline>You pay</Overline>
            <Text size={13} weight={500} color={colors.textMuted}>
              Balance {formatNumber(balance, from.decimals)}
            </Text>
          </View>
          <View style={styles.amountRow}>
            <TextInput
              accessibilityLabel="Amount to pay"
              value={pay}
              onChangeText={(v) => {
                setPay(v);
                setError(null);
              }}
              placeholder="0"
              placeholderTextColor={colors.iconMuted}
              keyboardType="decimal-pad"
              inputMode="decimal"
              selectionColor={colors.accent}
              style={styles.amountInput}
            />
            <TokenPill symbol={from.symbol} color={colors.token[from.symbol]} />
          </View>
          <Text size={14} color={colors.textSecondary}>
            ≈ {fiat.format(payChf)}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Flip tokens"
          onPress={() => {
            setFlipped(!flipped);
            setPay(receiveValue ? receiveValue.toFixed(to.decimals) : '');
          }}
          style={styles.flip}
        >
          <Icon name="flip" size={18} color={colors.inkStrong} strokeWidth={2.4} />
        </Pressable>

        <View style={styles.panel}>
          <Overline>You receive</Overline>
          <View style={styles.amountRow}>
            <Text size={34} weight={700} style={styles.flex} numberOfLines={1}>
              {formatNumber(receiveValue, to.decimals)}
            </Text>
            <TokenPill symbol={to.symbol} color={colors.token[to.symbol]} />
          </View>
          <Text size={14} color={colors.textSecondary}>
            ≈ {fiat.format(receiveChf)}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        {details.map(([label, value], i) => (
          <View key={label} style={[styles.row, i < details.length - 1 && styles.rowDivider]}>
            <Text size={14} color={colors.textSecondary}>
              {label}
            </Text>
            <Text size={14} weight={600}>
              {value}
            </Text>
          </View>
        ))}
      </View>

      <Spacer />

      <View style={styles.footer}>
        {error ? (
          <Text accessibilityRole="alert" size={13} weight={600} color={colors.accentText} align="center">
            {error}
          </Text>
        ) : null}
        <Button label="Review swap" onPress={review} />
        <Text size={12} color={colors.textMuted} align="center" accessibilityLiveRegion="none">
          Quote refreshes in {secondsLeft} s
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  settings: { width: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  panels: { gap: 6, position: 'relative' },
  panel: {
    gap: 12,
    padding: 16,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
  },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  amountInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bold,
    fontSize: 34,
    color: colors.ink,
    padding: 0,
    outlineWidth: 0,
  },
  flip: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 44,
    height: 44,
    marginLeft: -22,
    marginTop: -22,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
    borderWidth: 4,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  footer: { gap: 8 },
});
