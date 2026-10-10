import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { colors } from '@/theme/tokens';

import { Icon } from './Icon';
import { Text } from './Text';

type BackProps = {
  onPress?: () => void;
  icon?: 'back' | 'close';
  color?: string;
};

export function BackButton({ onPress, icon = 'back', color = colors.ink }: BackProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={icon === 'close' ? 'Close' : 'Back'}
      hitSlop={4}
      onPress={onPress ?? (() => router.back())}
      style={styles.slot}
    >
      <Icon name={icon} size={icon === 'close' ? 22 : 24} color={color} />
    </Pressable>
  );
}

type NavHeaderProps = {
  title?: string;
  /** Replaces the plain title (e.g. token mark + name on coin detail). */
  center?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  onBack?: () => void;
  backIcon?: 'back' | 'close';
};

/** `grid-template-columns: 44px 1fr 44px; height: 44px` header used across the app. */
export function NavHeader({ title, center, left, right, onBack, backIcon }: NavHeaderProps) {
  return (
    <View style={styles.row}>
      {left ?? <BackButton onPress={onBack} icon={backIcon} />}
      <View style={styles.center}>
        {center ?? (
          <Text accessibilityRole="header" size={17} weight={700} align="center" numberOfLines={1}>
            {title}
          </Text>
        )}
      </View>
      <View style={[styles.slot, styles.right]}>{right}</View>
    </View>
  );
}

type StepHeaderProps = {
  step: number;
  total: number;
  accent?: string;
  onBack?: () => void;
};

/**
 * Onboarding header: back chevron + segmented progress. Completed steps are
 * dark, the current step uses the accent, upcoming steps are light grey.
 */
export function StepHeader({ step, total, accent = colors.accent, onBack }: StepHeaderProps) {
  return (
    <View style={[styles.row, styles.spaced]}>
      <BackButton onPress={onBack} />
      <View
        style={styles.steps}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${step} of ${total}`}
        accessibilityValue={{ min: 1, max: total, now: step }}
      >
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={[
              styles.step,
              { backgroundColor: i + 1 < step ? colors.primary : i + 1 === step ? accent : colors.border },
            ]}
          />
        ))}
      </View>
      <View style={styles.slot} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 44, flexDirection: 'row', alignItems: 'center' },
  spaced: { justifyContent: 'space-between' },
  slot: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  right: { alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  steps: { flexDirection: 'row', gap: 6 },
  step: { width: 28, height: 4 },
});
