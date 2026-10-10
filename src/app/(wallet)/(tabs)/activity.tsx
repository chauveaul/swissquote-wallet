import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { Overline, Text } from '@/components/Text';
import { groupActivity, useActivity } from '@/features/market/queries';
import type { ActivityItem, ActivityKind } from '@/features/market/types';
import { colors, radii } from '@/theme/tokens';

const KIND_ICON: Record<ActivityKind, IconName> = {
  send: 'send',
  receive: 'receive',
  swap: 'swap',
  approve: 'check',
};

function presentation(item: ActivityItem) {
  switch (item.status) {
    case 'pending':
      return {
        status: item.eta ? `Pending · ${item.eta}` : 'Pending',
        statusColor: colors.accentText,
        iconBg: colors.accentSurface,
        iconFg: colors.accentText,
      };
    case 'failed':
      return { status: 'Failed', statusColor: colors.textMuted, iconBg: colors.surfaceMuted, iconFg: colors.textMuted };
    default:
      return { status: 'Confirmed', statusColor: colors.positive, iconBg: colors.surfaceMuted, iconFg: colors.ink };
  }
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const p = presentation(item);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${p.status}, ${item.amount}, ${item.fiat}`}
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
          {item.fiat}
        </Text>
      </View>
    </Pressable>
  );
}

/** 10 Activity */
export default function Activity() {
  const insets = useSafeAreaInsets();
  const { data, refetch, isRefetching } = useActivity();
  const sections = groupActivity(data).map((g) => ({ title: g.label, data: g.items }));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text accessibilityRole="header" size={28} weight={700} tracking={-0.01}>
          Activity
        </Text>
        {/* Network filter has no picker in the design yet. */}
        <Pressable accessibilityRole="button" accessibilityLabel="Filter: All networks" style={styles.filter}>
          <Text size={13} weight={600}>
            All networks
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
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
