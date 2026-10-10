import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/tokens';

/** Space kept between the focused input and the top of the keyboard. */
const KEYBOARD_GAP = 24;

export type ScreenProps = {
  children: ReactNode;
  background?: string;
  /** Design padding, added on top of the safe-area insets. */
  paddingTop?: number;
  paddingHorizontal?: number;
  paddingBottom?: number;
  gap?: number;
  /** Scrollable by default so the 844pt designs still fit on smaller phones. */
  scroll?: boolean;
  statusBar?: 'dark' | 'light';
  /** Rendered below the scroll area, outside of it (e.g. the bottom tab bar). */
  footer?: ReactNode;
  style?: ViewStyle;
};

/**
 * Root container for every screen. Applies the design's frame paddings on top of
 * the device safe area so the layout matches the 390×844 artboards on an iPhone.
 */
export function Screen({
  children,
  background = colors.surface,
  paddingTop = 12,
  paddingHorizontal = 24,
  paddingBottom = 32,
  gap = 0,
  scroll = true,
  statusBar = 'dark',
  footer,
  style,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const content = [
    {
      flexGrow: 1,
      paddingTop: insets.top + paddingTop,
      paddingHorizontal,
      paddingBottom: footer ? paddingBottom : Math.max(paddingBottom, insets.bottom),
      gap,
    },
    style,
  ];

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <StatusBar style={statusBar} />
      {scroll ? (
        // Scrolls the focused input above the keyboard and keeps the rest of
        // the form reachable while the keyboard is open (iOS and Android).
        // "layout" mode lets the <Spacer /> shrink, so the bottom action
        // (Review, Confirm…) rides up above the keyboard instead of behind it.
        <KeyboardAwareScrollView
          mode="layout"
          style={styles.root}
          contentContainerStyle={styles.grow}
          bottomOffset={KEYBOARD_GAP}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {/* Padding and gap live here, not on the scroll content: the keyboard
              spacer is appended after this view and must not get a gap. */}
          <View style={[styles.grow, content]}>{children}</View>
        </KeyboardAwareScrollView>
      ) : (
        <View style={[styles.root, content]}>{children}</View>
      )}
      {footer}
    </View>
  );
}

/** Equivalent of the design's `<div style="flex-grow: 1">` spacer. */
export function Spacer() {
  return <View style={styles.root} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  grow: { flexGrow: 1 },
});
