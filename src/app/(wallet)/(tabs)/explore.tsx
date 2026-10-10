import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { TokenMark } from '@/components/Marks';
import { Overline, Text } from '@/components/Text';
import { useMarkets } from '@/features/market/queries';
import { useFiat } from '@/features/settings/useFiat';
import type { MarketToken } from '@/features/market/types';
import { formatPercentChange } from '@/lib/format';
import { colors, fonts, radii } from '@/theme/tokens';

function changeColor(pct: number) {
  if (pct > 0) return colors.positive;
  if (pct < 0) return colors.accentText;
  return colors.textMuted;
}

function MarketRow({ token }: { token: MarketToken }) {
  const fiat = useFiat();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${token.name}, ${fiat.price(token.priceChf)}, ${formatPercentChange(token.change24hPct)} today`}
      onPress={() => router.push({ pathname: '/token/[symbol]', params: { symbol: token.symbol } })}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      <TokenMark label={token.mark} color={token.color} />
      <View style={styles.main}>
        <Text size={16} weight={600}>
          {token.name}
        </Text>
        <Text size={13} color={colors.textMuted}>
          {token.symbol}
        </Text>
      </View>
      <View style={styles.value}>
        <Text size={16} weight={600}>
          {fiat.price(token.priceChf)}
        </Text>
        <Text size={13} weight={600} color={changeColor(token.change24hPct)}>
          {formatPercentChange(token.change24hPct)}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Explore. Not drawn in the design; built from its components: Activity's
 * header, Home's token rows, Send's input styling.
 */
export default function Explore() {
  const insets = useSafeAreaInsets();
  const { data = [], refetch, isRefetching } = useMarkets();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((t) => t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q));
  }, [data, query]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text accessibilityRole="header" size={28} weight={700} tracking={-0.01}>
          Explore
        </Text>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.textMuted} />
          <TextInput
            accessibilityLabel="Search tokens"
            value={query}
            onChangeText={setQuery}
            placeholder="Search tokens"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            selectionColor={colors.accent}
            style={styles.searchInput}
          />
        </View>
      </View>

      {/* Shrinks the list above the keyboard so every result stays reachable. */}
      <KeyboardAvoidingView behavior="padding" automaticOffset style={styles.flex}>
        <FlatList
          data={results}
          keyExtractor={(t) => t.symbol}
          renderItem={({ item }) => <MarketRow token={item} />}
          ListHeaderComponent={
            <Overline accessibilityRole="header" style={styles.sectionLabel}>
              Markets
            </Overline>
          }
          ListEmptyComponent={
            <Text size={14} color={colors.textMuted} style={styles.empty}>
              No tokens match “{query.trim()}”.
            </Text>
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onRefresh={refetch}
          refreshing={isRefetching}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  header: { paddingTop: 24, paddingHorizontal: 24, paddingBottom: 8 },
  searchWrap: { paddingHorizontal: 24, paddingTop: 8 },
  search: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
    outlineWidth: 0,
  },
  sectionLabel: {
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  main: { flex: 1, minWidth: 0, gap: 2 },
  value: { alignItems: 'flex-end', gap: 2 },
  empty: { paddingHorizontal: 24, paddingTop: 16 },
});
