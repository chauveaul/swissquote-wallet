import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii } from '@/theme/tokens';

import { Icon } from './Icon';
import { Text } from './Text';

export type SheetOption<T extends string> = { value: T; label: string; leading?: ReactNode };

type Props<T extends string> = {
  visible: boolean;
  title: string;
  options: readonly SheetOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  onClose: () => void;
};

/** Bottom sheet with a single-choice list (e.g. the Activity network filter). */
export function OptionSheet<T extends string>({ visible, title, options, selected, onSelect, onClose }: Props<T>) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom) }]}>
          <View style={styles.header}>
            <Text accessibilityRole="header" size={17} weight={700}>
              {title}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8}>
              <Icon name="close" size={22} />
            </Pressable>
          </View>
          <ScrollView accessibilityRole="radiogroup" style={styles.list}>
            {options.map((o) => {
              const on = o.value === selected;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={o.label}
                  onPress={() => {
                    onSelect(o.value);
                    onClose();
                  }}
                  style={({ pressed }) => [styles.row, (pressed || on) && { backgroundColor: colors.surfaceMuted }]}
                >
                  {o.leading}
                  <Text size={15} weight={600} style={styles.flex}>
                    {o.label}
                  </Text>
                  <View style={styles.check}>{on ? <Icon name="check" size={18} strokeWidth={2.4} /> : null}</View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  flex: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(18,18,18,0.45)' },
  sheet: {
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sm * 3,
    borderTopRightRadius: radii.sm * 3,
    paddingTop: 16,
    gap: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  check: { width: 20, alignItems: 'center' },
});
