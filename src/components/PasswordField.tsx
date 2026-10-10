import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, radii } from '@/theme/tokens';

import { Icon } from './Icon';
import { Overline, Text } from './Text';

type Props = Omit<TextInputProps, 'secureTextEntry' | 'style'> & {
  label: string;
  tone?: 'dark' | 'light';
  error?: string | null;
};

/** Password input with a show/hide toggle. Never autocorrected, autofilled or cached by the keyboard. */
export const PasswordField = forwardRef<TextInput, Props>(function PasswordField(
  { label, tone = 'light', error, ...input },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const dark = tone === 'dark';
  const borderColor = error ? colors.accent : dark ? colors.dark.border : colors.primary;

  return (
    <View style={styles.wrap}>
      {dark ? (
        <Text size={14} weight={600} color={colors.dark.label}>
          {label}
        </Text>
      ) : (
        <Overline>{label}</Overline>
      )}
      <View
        style={[
          styles.field,
          { borderColor, backgroundColor: dark ? colors.dark.field : colors.surface },
        ]}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          importantForAutofill="no"
          textContentType="none"
          contextMenuHidden={!visible}
          placeholderTextColor={dark ? colors.textMuted : colors.iconMuted}
          selectionColor={colors.accent}
          style={[styles.input, { color: dark ? colors.surface : colors.ink }]}
          {...input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          onPress={() => setVisible((v) => !v)}
          style={styles.toggle}
        >
          <Icon name="eye" size={20} color={dark ? colors.dark.textSecondary : colors.textMuted} />
        </Pressable>
      </View>
      {error ? (
        <Text accessibilityRole="alert" size={13} weight={600} color={dark ? colors.accent : colors.accentText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  field: {
    height: 55,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radii.sm,
    paddingLeft: 14,
    paddingRight: 4,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    fontFamily: fonts.regular,
    fontSize: 16,
    outlineWidth: 0,
  },
  toggle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
