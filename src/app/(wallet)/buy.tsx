import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/Button';
import { NavHeader } from '@/components/Header';
import { TokenPill } from '@/components/Marks';
import { Screen, Spacer } from '@/components/Screen';
import { Overline, Text } from '@/components/Text';
import { TokenPicker } from '@/components/TokenPicker';
import { useMarkets } from '@/features/market/queries';
import { MAX_BUY_CHF, MIN_BUY_CHF, PAYMENT_METHOD, quoteBuy, useBuyDraft } from '@/features/buy/quote';
import { useNetworkId, useSelectedAccount } from '@/features/wallet/store';
import { formatChf, formatNumber, truncateAddress } from '@/lib/format';
import { getNetwork } from '@/lib/networks';
import { colors, fonts, radii } from '@/theme/tokens';

/** Buy. Not drawn in the design; built from the Swap screen's components. */
export default function Buy() {
  const account = useSelectedAccount();
  const network = getNetwork(useNetworkId());
  const { symbol, chf, setSymbol, setChf } = useBuyDraft();
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const { data: tokens = [] } = useMarkets();

  const amount = Number(chf) || 0;
  const q = quoteBuy(symbol, amount);

  const details: [string, string][] = [
    ['Price', q.priceLabel],
    ['Paid from', PAYMENT_METHOD],
    ['Deposit to', `${account.name} · ${truncateAddress(account.address)}`],
    ['Network', network.name],
    ['Swissquote fee', q.fee],
  ];

  const review = () => {
    setError(null);
    if (amount < MIN_BUY_CHF) return setError(`The minimum purchase is ${formatChf(MIN_BUY_CHF)}.`);
    if (amount > MAX_BUY_CHF) return setError(`The maximum purchase is ${formatChf(MAX_BUY_CHF)}.`);
    router.push('/buy-review');
  };

  return (
    <Screen gap={20}>
      <NavHeader title="Buy" />

      <View style={styles.panels}>
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Overline>You pay</Overline>
            <Text size={13} weight={500} color={colors.textMuted}>
              {formatChf(MIN_BUY_CHF)} – {formatChf(MAX_BUY_CHF)}
            </Text>
          </View>
          <View style={styles.amountRow}>
            <TextInput
              accessibilityLabel="Amount in CHF"
              value={chf}
              onChangeText={(v) => {
                setChf(v);
                setError(null);
              }}
              placeholder="0"
              placeholderTextColor={colors.iconMuted}
              keyboardType="decimal-pad"
              inputMode="decimal"
              selectionColor={colors.accent}
              style={styles.amountInput}
            />
            <View style={styles.currency}>
              <Text size={15} weight={700}>
                CHF
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <Overline>You receive (estimated)</Overline>
          <View style={styles.amountRow}>
            <Text size={34} weight={700} style={styles.flex} numberOfLines={1}>
              {formatNumber(q.receive, q.decimals)}
            </Text>
            <TokenPill symbol={symbol} color={colors.token[symbol]} onPress={() => setPicking(true)} />
          </View>
        </View>
      </View>

      <View style={styles.card}>
        {details.map(([label, value], i) => (
          <View key={label} style={[styles.row, i < details.length - 1 && styles.rowDivider]}>
            <Text size={14} color={colors.textSecondary}>
              {label}
            </Text>
            <Text size={14} weight={600} style={styles.rowValue} align="right" numberOfLines={1}>
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
        <Button label="Review purchase" onPress={review} />
      </View>

      <TokenPicker
        visible={picking}
        title="Token to buy"
        tokens={tokens}
        selected={symbol}
        onSelect={setSymbol}
        onClose={() => setPicking(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  panels: { gap: 6 },
  panel: { gap: 12, padding: 16, backgroundColor: colors.surfaceMuted, borderRadius: radii.sm },
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
  currency: {
    height: 40,
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
  },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowValue: { flex: 1 },
  footer: { gap: 8 },
});
