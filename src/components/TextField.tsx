import { forwardRef, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, radii } from '@/theme/tokens';

import { Overline, Text } from './Text';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string | null;
  mono?: boolean;
  /** Trailing element inside the field (e.g. a scan button). */
  right?: ReactNode;
};

/** Labelled single-line input in the style of Send's "To" field. */
export const TextField = forwardRef<TextInput, Props>(function TextField({ label, error, mono, right, ...input }, ref) {
  return (
    <View style={styles.wrap}>
      <Overline>{label}</Overline>
      <View style={[styles.field, error ? { borderColor: colors.accent } : null]}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.iconMuted}
          selectionColor={colors.accent}
          style={[styles.input, { fontFamily: mono ? fonts.mono : fonts.regular, fontSize: mono ? 13 : 16 }]}
          {...input}
        />
        {right}
      </View>
      {error ? (
        <Text accessibilityRole="alert" size={13} weight={600} color={colors.accentText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  field: {
    // 52px + 1.5px borders (content-box in the design).
    height: 55,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.sm,
    paddingLeft: 12,
    paddingRight: 4,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, minWidth: 0, height: '100%', color: colors.ink, outlineWidth: 0 },
});
