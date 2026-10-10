import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radii } from '@/theme/tokens';

import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  tone?: 'warning' | 'info';
  children: ReactNode;
  /** Body font size; the design uses 14 (default) or 13 in tighter layouts. */
  size?: 13 | 14;
  /** Background override (Receive uses an info callout on white). */
  background?: string;
};

/** Security notice block ("Never share this phrase…", network warnings). */
export function Callout({ tone = 'warning', children, size = 14, background }: Props) {
  const warning = tone === 'warning';
  const compact = size === 13;
  return (
    <View
      accessibilityRole={warning ? 'alert' : undefined}
      style={[
        styles.box,
        {
          backgroundColor: background ?? (warning ? colors.accentSurface : colors.surface),
          paddingVertical: compact ? 12 : 14,
        },
      ]}
    >
      <View style={styles.icon}>
        <Icon
          name={warning ? 'warning' : 'info'}
          size={compact ? 18 : 20}
          color={warning ? colors.accentText : colors.ink}
        />
      </View>
      <Text size={size} lineHeight={1.45} style={styles.body}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    borderRadius: radii.sm,
  },
  icon: { marginTop: 1 },
  body: { flex: 1 },
});
