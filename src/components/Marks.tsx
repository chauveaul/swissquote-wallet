import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '@/theme/tokens';

import { Icon } from './Icon';
import { Text } from './Text';

type TokenMarkProps = {
  label: string;
  color: string;
  size?: number;
  fontSize?: number;
};

/** Round token/network badge with its ticker (until real token logos are wired in). */
export function TokenMark({ label, color, size = 40, fontSize = 13 }: TokenMarkProps) {
  return (
    <View
      accessible={false}
      style={[styles.center, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}
    >
      <Text size={fontSize} weight={700} color={colors.surface}>
        {label}
      </Text>
    </View>
  );
}

/** Solid colour disc identifying an account. */
export function AccountAvatar({ color, size = 36 }: { color: string; size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}
    />
  );
}

type TokenPillProps = {
  symbol: string;
  color: string;
  onPress?: () => void;
};

/** Token selector chip used inside amount inputs (Send, Swap). */
export function TokenPill({ symbol, color, onPress }: TokenPillProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Token: ${symbol}. Change token`}
      onPress={onPress}
      style={styles.pill}
    >
      <TokenMark label={symbol} color={color} size={28} fontSize={symbol.length > 3 ? 9 : 10} />
      <Text size={15} weight={700}>
        {symbol}
      </Text>
      <Icon name="chevronDown" size={14} strokeWidth={2.4} />
    </Pressable>
  );
}

/**
 * The design ships a dashed "Swissquote logo" placeholder. Replace this with the
 * official brand asset from Swissquote's brand team before release.
 */
export function LogoPlaceholder({ dark = false }: { dark?: boolean }) {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Swissquote"
      style={[
        styles.logo,
        { borderColor: dark ? colors.dark.placeholderBorder : colors.logoPlaceholderBorder },
      ]}
    >
      <Text
        size={12}
        tracking={0.04}
        uppercase
        color={dark ? colors.dark.textSecondary : colors.logoPlaceholderText}
      >
        Swissquote logo
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  pill: {
    height: 40,
    paddingLeft: 6,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
  },
  logo: {
    // 148×36 + 1.5px dashed border (content-box in the design).
    width: 151,
    height: 39,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
