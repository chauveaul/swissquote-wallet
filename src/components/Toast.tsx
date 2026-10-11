import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { colors, radii } from '@/theme/tokens';

import { Text } from './Text';

type ToastState = { message: string | null };

const DURATION_MS = 3000;

const useToastStore = create<ToastState>(() => ({ message: null }));

/** Fire-and-forget toast (e.g. "Deposit confirmed"). No queue — a new call replaces whatever's showing. */
export function showToast(message: string) {
  useToastStore.setState({ message });
}

/** Mount once, near the root — see `src/app/_layout.tsx`. */
export function ToastHost() {
  const message = useToastStore((s) => s.message);
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!message) return;
    if (timer.current) clearTimeout(timer.current);
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        useToastStore.setState({ message: null });
      });
    }, DURATION_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [message, opacity]);

  if (!message) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 16, opacity }]}>
      <Text size={14} weight={600} color={colors.surface} align="center">
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    backgroundColor: colors.ink,
    borderRadius: radii.sm,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
});
