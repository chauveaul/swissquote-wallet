import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'inverse' | 'outlineDark';

const variants: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.surface },
  secondary: { bg: colors.surface, fg: colors.ink, border: colors.primary },
  inverse: { bg: colors.surface, fg: colors.inkStrong },
  outlineDark: { bg: 'transparent', fg: colors.surface, border: colors.dark.border },
};

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  height?: number;
  fontSize?: number;
  icon?: IconName;
  iconSize?: number;
  iconStrokeWidth?: number;
  /** Gap between icon and label. */
  gap?: number;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  height = 52,
  fontSize = 16,
  icon,
  iconSize = 20,
  iconStrokeWidth,
  gap = 8,
  disabled,
  loading,
  style,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const v = variants[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          backgroundColor: v.bg,
          borderColor: v.border,
          borderWidth: v.border ? 1.5 : 0,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={[styles.content, { gap }]}>
          {icon ? <Icon name={icon} size={iconSize} color={v.fg} strokeWidth={iconStrokeWidth} /> : null}
          <Text size={fontSize} weight={600} color={v.fg}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
