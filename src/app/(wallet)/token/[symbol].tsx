import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Button } from '@/components/Button';
import { NavHeader } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { TokenMark } from '@/components/Marks';
import { PriceChart } from '@/components/PriceChart';
import { Screen, Spacer } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Overline, Text } from '@/components/Text';
import { useMarketToken, usePriceHistory, useToken } from '@/features/market/queries';
import type { PriceRange, TokenSymbol } from '@/features/market/types';
import { useFiat } from '@/features/settings/useFiat';
import { useNetworkId, useSelectedAccount } from '@/features/wallet/store';
import { formatNumber, priceDecimals } from '@/lib/format';
import { getNetwork } from '@/lib/networks';
import { colors, radii } from '@/theme/tokens';

const RANGES: { value: PriceRange; label: string }[] = [
  { value: '1D', label: '1D' },
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'All' },
];

const RANGE_NAMES: Record<PriceRange, string> = {
  '1D': 'Past day',
  '1W': 'Past week',
  '1M': 'Past month',
  '1Y': 'Past year',
  ALL: 'All time',
};

/** 04b Coin detail & price history */
export default function TokenDetail() {
  const fiat = useFiat();
  const { symbol } = useLocalSearchParams<{ symbol: TokenSymbol }>();
  const account = useSelectedAccount();
  const network = getNetwork(useNetworkId());
  const token = useToken(account.index, symbol);
  const market = useMarketToken(symbol);
  const [range, setRange] = useState<PriceRange>('1M');
  const [hover, setHover] = useState<number | null>(null);
  const [watched, setWatched] = useState(false);
  const { data: chfPoints = [] } = usePriceHistory(symbol, range);
  const points = useMemo(
    () => chfPoints.map((p) => ({ ...p, value: fiat.convert(p.value) })),
    [chfPoints, fiat],
  );

  const name = token?.name ?? market?.name ?? symbol;
  const n = points.length;
  const first = points[0]?.value ?? 0;
  const last = points[n - 1]?.value ?? 0;
  const hovered = hover !== null && hover < n ? points[hover]! : null;
  const ref = hovered?.value ?? last;
  const diff = ref - first;
  const pct = first ? (diff / first) * 100 : 0;
  const up = diff >= 0;
  const decimals = priceDecimals(last);

  return (
    <Screen paddingHorizontal={0} gap={16}>
      <View style={styles.gutter}>
        <NavHeader
          center={
            <View style={styles.title}>
              <TokenMark
                label={market?.mark ?? symbol}
                color={market?.color ?? colors.primary}
                size={28}
                fontSize={10}
              />
              <Text accessibilityRole="header" size={17} weight={700}>
                {name}
              </Text>
            </View>
          }
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={watched ? 'Remove from watchlist' : 'Add to watchlist'}
              accessibilityState={{ selected: watched }}
              onPress={() => setWatched((w) => !w)}
              style={styles.star}
            >
              <Icon name="star" size={22} color={watched ? colors.accent : colors.ink} />
            </Pressable>
          }
        />
      </View>

      <View style={[styles.gutter, styles.head]}>
        <Overline>{hovered ? hovered.label : `${name} price`}</Overline>
        <View style={styles.priceRow}>
          <Text size={20} weight={600} color={colors.textSecondary}>
            {fiat.code}
          </Text>
          <Text size={40} weight={700} tracking={-0.02} lineHeight={1} tabular>
            {formatNumber(ref, decimals)}
          </Text>
        </View>
        <View style={styles.changeRow}>
          <Text size={14} weight={600} color={up ? colors.positive : colors.accentText}>
            {up ? '+ ' : '− '}{fiat.code} {formatNumber(Math.abs(diff), decimals)} ({Math.abs(pct).toFixed(2)}%)
          </Text>
          <Text size={14} color={colors.textMuted}>
            {RANGE_NAMES[range]}
          </Text>
        </View>
      </View>

      <View style={[styles.gutter, styles.chart]}>
        {n > 1 ? (
          <PriceChart
            points={points}
            currency={fiat.code}
            hover={hover}
            onHover={setHover}
            accessibilityLabel={`${name} price in ${fiat.code}, ${RANGE_NAMES[range].toLowerCase()}, from ${fiat.code} ${formatNumber(first, decimals)} to ${fiat.code} ${formatNumber(last, decimals)}`}
          />
        ) : (
          <View style={styles.chartPlaceholder} />
        )}
        <View style={styles.axis}>
          <Text size={12} color={colors.textMuted}>
            {points[0]?.label}
          </Text>
          <Text size={12} color={colors.textMuted}>
            {range === '1D' ? 'Now' : points[n - 1]?.label}
          </Text>
        </View>
      </View>

      <View style={styles.gutter}>
        <SegmentedControl
          role="tablist"
          accessibilityLabel="Time range"
          options={RANGES}
          value={range}
          onChange={(r) => {
            setRange(r);
            setHover(null);
          }}
          itemHeight={40}
          fontSize={14}
        />
      </View>

      <View style={styles.position}>
        <Overline style={styles.positionLabel}>Your position</Overline>
        <View style={styles.positionRow}>
          <Text size={20} weight={700}>
            {formatNumber(token?.amount ?? 0, token?.displayDecimals ?? 4)} {symbol}
          </Text>
          <Text size={16} weight={600}>
            {fiat.format(token?.valueChf ?? 0)}
          </Text>
        </View>
        <View style={styles.networkRow}>
          <Text size={14} color={colors.textSecondary}>
            Network
          </Text>
          <Text size={14} weight={600}>
            {network.name}
          </Text>
        </View>
      </View>

      <Spacer />

      <View style={[styles.gutter, styles.actions]}>
        <Button label="Send" fontSize={15} style={styles.action} onPress={() => router.push('/send')} />
        <Button
          label="Swap"
          variant="secondary"
          fontSize={15}
          style={styles.action}
          onPress={() => router.push('/swap')}
        />
        <Button
          label="Receive"
          variant="secondary"
          fontSize={15}
          style={styles.action}
          onPress={() => router.push('/receive')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gutter: { paddingHorizontal: 24 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  star: { width: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  head: { gap: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chart: { gap: 6 },
  chartPlaceholder: { height: 220 },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  position: {
    marginTop: 4,
    marginHorizontal: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  positionLabel: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 6 },
  positionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  networkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
});
