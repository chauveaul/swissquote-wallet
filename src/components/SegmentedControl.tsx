import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii } from '@/theme/tokens';

import { Text } from './Text';

type Option<T extends string | number> = { value: T; label: string };

type Props<T extends string | number> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  /** `tablist` for chart ranges, `radiogroup` for exclusive choices. */
  role?: 'tablist' | 'radiogroup';
  itemHeight?: number;
  fontSize?: number;
  style?: StyleProp<ViewStyle>;
};

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  accessibilityLabel,
  role = 'radiogroup',
  itemHeight = 36,
  fontSize = 13,
  style,
}: Props<T>) {
  return (
    <View accessibilityRole={role} accessibilityLabel={accessibilityLabel} style={[styles.track, style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole={role === 'tablist' ? 'tab' : 'radio'}
            accessibilityState={role === 'tablist' ? { selected: on } : { checked: on }}
            onPress={() => onChange(o.value)}
            style={[styles.item, { height: itemHeight }, on && styles.itemOn]}
          >
            <Text size={fontSize} weight={on ? 700 : 500} color={on ? colors.ink : colors.textSecondary}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
  },
  item: {
    flex: 1,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemOn: {
    backgroundColor: colors.surface,
    boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
  },
});
