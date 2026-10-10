import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '@/theme/tokens';

import { Icon } from './Icon';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Label content; pressing anywhere on the row toggles the box. */
  children: ReactNode;
  accessibilityLabel: string;
  invalid?: boolean;
};

/** Native-looking checkbox (`accent-color: #323232`) with a wrapping label. */
export function Checkbox({ checked, onChange, children, accessibilityLabel, invalid }: Props) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      onPress={() => onChange(!checked)}
      style={styles.row}
    >
      <View
        style={[
          styles.box,
          checked && styles.boxOn,
          invalid && !checked && { borderColor: colors.accentText },
        ]}
      >
        {checked ? <Icon name="check" size={14} color={colors.surface} strokeWidth={3} /> : null}
      </View>
      <View style={styles.label}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  box: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 3,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary },
  label: { flex: 1 },
});
