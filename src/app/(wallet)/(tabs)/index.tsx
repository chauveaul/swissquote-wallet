import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { TokenMark } from '@/components/Marks';
import { Overline, Text } from '@/components/Text';
import { usePortfolio } from '@/features/market/queries';
import type { TokenHolding } from '@/features/market/types';
import { useFiat } from '@/features/settings/useFiat';
import { useNetworkId, useSelectedAccount } from '@/features/wallet/store';
import { formatNumber, formatPercentChange, signPrefix, truncateAddress } from '@/lib/format';
import { getNetwork } from '@/lib/networks';
import { colors, radii } from '@/theme/tokens';

const ACTIONS: { label: string; icon: IconName; href?: Href; primary?: boolean }[] = [
  { label: 'Buy', icon: 'plus', href: '/buy' },
  { label: 'Swap', icon: 'swap', href: '/swap' },
  { label: 'Send', icon: 'send', href: '/send', primary: true },
  { label: 'Receive', icon: 'receive', href: '/receive' },
];

function changeColor(pct: number) {
  if (pct > 0) return colors.positive;
  if (pct < 0) return colors.accentText;
  return colors.textMuted;
}

function TokenRow({ token }: { token: TokenHolding }) {
  const fiat = useFiat();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${token.name}, ${formatNumber(token.amount, token.displayDecimals)} ${token.symbol}, ${fiat.format(token.valueChf)}`}
      onPress={() => router.push({ pathname: '/token/[symbol]', params: { symbol: token.symbol } })}
      style={({ pressed }) => [styles.tokenRow, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      <TokenMark label={token.mark} color={token.color} />
      <View style={styles.tokenMain}>
        <Text size={16} weight={600}>
          {token.name}
        </Text>
        <Text size={13} color={colors.textMuted}>
          {formatNumber(token.amount, token.displayDecimals)} {token.symbol}
        </Text>
      </View>
      <View style={styles.tokenValue}>
        <Text size={16} weight={600}>
          {fiat.format(token.valueChf)}
        </Text>
        <Text size={13} weight={600} color={changeColor(token.change24hPct)}>
          {formatPercentChange(token.change24hPct)}
        </Text>
      </View>
    </Pressable>
  );
}

/** 04 Wallet home */
export default function Home() {
  const fiat = useFiat();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const account = useSelectedAccount();
  const network = getNetwork(useNetworkId());
  const { data: portfolio, isRefetching } = usePortfolio(account.index);

  const change = portfolio?.changeTodayChf ?? 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Network: ${network.shortName}. Change network`}
          onPress={() => router.push('/accounts')}
          style={styles.networkPill}
        >
          <TokenMark label={network.mark} color={colors.primary} size={24} fontSize={11} />
          <Icon name="chevronDown" size={14} strokeWidth={2.4} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${account.name}, ${account.address}. Change account`}
          onPress={() => router.push('/accounts')}
          style={styles.account}
        >
          <View style={styles.accountName}>
            <Text size={16} weight={700}>
              {account.name}
            </Text>
            <Icon name="chevronDown" size={16} strokeWidth={2.4} />
          </View>
          <Text mono size={12} color={colors.textMuted}>
            {truncateAddress(account.address)}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan QR code"
          onPress={() => router.push('/scan')}
          style={styles.iconButton}
        >
          <Icon name="scan" size={22} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ['portfolio'] })}
          />
        }
      >
        <View style={styles.balance}>
          <Overline>Total balance</Overline>
          <View style={styles.balanceRow}>
            <Text size={20} weight={600} color={colors.textSecondary}>
              {fiat.code}
            </Text>
            <Text size={44} weight={700} tracking={-0.02} lineHeight={1} tabular>
              {fiat.number(portfolio?.totalChf ?? 0)}
            </Text>
          </View>
          <View style={styles.changeRow}>
            <Text size={14} weight={600} color={changeColor(change)}>
              {signPrefix(change)}{fiat.format(Math.abs(change))} ({Math.abs(portfolio?.changeTodayPct ?? 0).toFixed(2)}%)
            </Text>
            <Text size={14} color={colors.textMuted}>
              Today
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          {ACTIONS.map((a) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              onPress={a.href ? () => router.push(a.href!) : undefined}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: a.primary ? colors.primary : colors.surfaceMuted, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Icon name={a.icon} size={22} color={a.primary ? colors.surface : colors.ink} />
              <Text size={13} weight={600} color={a.primary ? colors.surface : colors.ink}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Overline accessibilityRole="header" style={styles.tokensHeading}>
          Tokens
        </Overline>
        {portfolio?.tokens.map((t) => <TokenRow key={t.symbol} token={t} />)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  topBar: {
    // 56px content + 12px top padding (content-box in the design).
    height: 68,
    paddingTop: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  networkPill: {
    height: 38,
    paddingLeft: 6,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
  },
  account: { alignItems: 'center', gap: 2, minHeight: 44, justifyContent: 'center' },
  accountName: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 8 },
  balance: { paddingTop: 28, paddingHorizontal: 24, paddingBottom: 24, gap: 8 },
  balanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 20 },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: radii.sm,
  },
  tokensHeading: {
    paddingTop: 4,
    paddingHorizontal: 24,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  tokenMain: { flex: 1, minWidth: 0, gap: 2 },
  tokenValue: { alignItems: 'flex-end', gap: 2 },
});
