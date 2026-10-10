import { useState } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { TokenMark } from '@/components/Marks';
import { OptionSheet, type SheetOption } from '@/components/OptionSheet';
import { Overline, Text } from '@/components/Text';
import { activityPresentation, activityValueLabel, KIND_ICON } from '@/features/market/activityPresentation';
import { groupActivity, useActivity } from '@/features/market/queries';
import { useFiat } from '@/features/settings/useFiat';
import type { ActivityItem } from '@/features/market/types';
import { networks, type NetworkId } from '@/lib/networks';
import { colors, radii } from '@/theme/tokens';

function ActivityRow({ item }: { item: ActivityItem }) {
  const p = activityPresentation(item);
  const value = activityValueLabel(item, useFiat());
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${p.status}, ${item.amount}, ${value}`}
      accessibilityHint="Shows the transaction details"
      onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      <View style={[styles.icon, { backgroundColor: p.iconBg }]}>
        <Icon name={KIND_ICON[item.kind]} size={20} color={p.iconFg} strokeWidth={2.2} />
      </View>
      <View style={styles.main}>
        <Text size={15} weight={600}>
          {item.title}
        </Text>
        <Text size={13} weight={600} color={p.statusColor}>
          {p.status}
        </Text>
      </View>
      <View style={styles.amounts}>
        <Text size={15} weight={600}>
          {item.amount}
        </Text>
        <Text size={13} color={colors.textMuted}>
          {value}
        </Text>
      </View>
    </Pressable>
  );
}

type NetworkFilter = 'all' | NetworkId;

const FILTER_OPTIONS: SheetOption<NetworkFilter>[] = [
  { value: 'all', label: 'All networks' },
  ...networks.map((n) => ({
    value: n.id,
    label: n.name,
    leading: <TokenMark label={n.mark} color={colors.primary} size={28} fontSize={11} />,
  })),
];

/** 10 Activity */
export default function Activity() {
  const insets = useSafeAreaInsets();
  const { data, refetch, isRefetching } = useActivity();
  const [filter, setFilter] = useState<NetworkFilter>('all');
  const [picking, setPicking] = useState(false);
  const visible = filter === 'all' ? data : data.filter((a) => a.networkId === filter);
  const sections = groupActivity(visible).map((g) => ({ title: g.label, data: g.items }));
  const filterLabel = filter === 'all' ? 'All networks' : networks.find((n) => n.id === filter)!.name;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text accessibilityRole="header" size={28} weight={700} tracking={-0.01}>
          Activity
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Filter: ${filterLabel}. Change network`}
          onPress={() => setPicking(true)}
          style={styles.filter}
        >
          <Text size={13} weight={600}>
            {filterLabel}
          </Text>
          <Icon name="chevronDown" size={14} strokeWidth={2.4} />
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <Overline accessibilityRole="header" style={styles.groupLabel}>
            {section.title}
          </Overline>
        )}
        renderItem={({ item }) => <ActivityRow item={item} />}
        stickySectionHeadersEnabled={false}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          <Text size={15} color={colors.textSecondary} align="center" style={styles.empty}>
            No activity on {filterLabel} yet.
          </Text>
        }
      />

      <OptionSheet
        visible={picking}
        title="Show activity on"
        options={FILTER_OPTIONS}
        selected={filter}
        onSelect={setFilter}
        onClose={() => setPicking(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  empty: { paddingVertical: 48, paddingHorizontal: 24 },
  header: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filter: {
    height: 36,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
  },
  groupLabel: { paddingTop: 16, paddingHorizontal: 24, paddingBottom: 6, backgroundColor: colors.surface },
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
  icon: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flex: 1, minWidth: 0, gap: 2 },
  amounts: { alignItems: 'flex-end', gap: 2 },
});
