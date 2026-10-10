import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type AccessibilityRole } from 'react-native';

import { colors, radii } from '@/theme/tokens';

import { Icon } from './Icon';
import { Overline, Text } from './Text';

/** Labelled white group of rows on the grey Settings background (design 11). */
export function SettingsGroup({ label, footer, children }: { label?: string; footer?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {label ? (
        <Overline accessibilityRole="header" style={styles.label}>
          {label}
        </Overline>
      ) : null}
      <View style={styles.group}>{children}</View>
      {footer ? (
        <Text size={13} lineHeight={1.4} color={colors.textMuted} style={styles.footer}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

type RowProps = {
  label: string;
  /** Second line under the label. */
  detail?: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  /** Replaces the chevron (e.g. a switch, a check, a button). */
  right?: ReactNode;
  selected?: boolean;
  role?: AccessibilityRole;
  last?: boolean;
  mono?: boolean;
};

/** One Settings row: label, optional value, chevron when it navigates. */
export function SettingsRow({
  label,
  detail,
  value,
  onPress,
  destructive,
  right,
  selected,
  role,
  last,
  mono,
}: RowProps) {
  const color = destructive ? colors.accentText : colors.ink;
  const body = (
    <>
      <View style={styles.main}>
        <Text size={15} weight={destructive ? 600 : 500} color={color}>
          {label}
        </Text>
        {detail ? (
          <Text size={13} lineHeight={1.4} mono={mono} color={colors.textMuted} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text size={14} color={colors.textMuted}>
          {value}
        </Text>
      ) : null}
      {right ??
        (role === 'radio' ? (
          <View style={styles.check}>{selected ? <Icon name="check" size={18} strokeWidth={2.4} /> : null}</View>
        ) : onPress ? (
          <Icon name="chevronRight" size={16} color={colors.iconMuted} strokeWidth={2.2} />
        ) : null)}
    </>
  );

  // Rows without their own action are plain views, so controls inside them
  // (a switch, a "Disconnect" button) stay interactive.
  if (!onPress) {
    return <View style={[styles.row, !last && styles.divider]}>{body}</View>;
  }
  return (
    <Pressable
      accessibilityRole={role ?? 'button'}
      accessibilityLabel={[label, detail, value].filter(Boolean).join(', ')}
      accessibilityState={role === 'radio' ? { checked: !!selected } : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && styles.divider,
        pressed && { backgroundColor: colors.surfaceMuted },
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: 6 },
  label: { paddingHorizontal: 8 },
  group: { backgroundColor: colors.surface, borderRadius: radii.sm, overflow: 'hidden' },
  footer: { paddingHorizontal: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    // 48px + 1px divider (content-box in the design).
    minHeight: 49,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  main: { flex: 1, gap: 2 },
  check: { width: 20, alignItems: 'center' },
});
